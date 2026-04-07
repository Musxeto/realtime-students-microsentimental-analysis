from __future__ import annotations

import argparse
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple


MASTER_CLASSES = [
    "handrise",
    "read",
    "write",
    "sleep",
    "using_device",
    "stand",
    "look_forward",
    "turn_head",
]


@dataclass(frozen=True)
class DatasetConfig:
    folder_name: str
    mapping: Dict[int, int]


DATASET_CONFIGS: List[DatasetConfig] = [
    DatasetConfig(
        folder_name="dataset",
        mapping={0: 0, 1: 1, 2: 3, 3: 5, 4: 4, 5: 2},
    ),
    DatasetConfig(
        folder_name="Student Behaviour Detection",
        mapping={0: 4, 1: 3, 2: 1, 3: 3, 4: 0, 5: 4, 6: 6, 7: 1, 8: 3, 9: 7, 10: 6, 11: 2},
    ),
    DatasetConfig(
        folder_name="student-classroom-activity.v6i.yolov11",
        mapping={0: 4, 1: 3, 2: 1},
    ),
]


EXCLUDED_DATASET = "classroom.v1i.yolov11"

SPLIT_ALIASES = {
    "train": ["train"],
    "valid": ["valid", "val"],
    "test": ["test"],
}

IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tif", ".tiff"]


def safe_prefix(name: str) -> str:
    return "".join(ch if ch.isalnum() else "_" for ch in name).strip("_").lower()


def ensure_output_structure(output_dir: Path) -> None:
    for split in ("train", "valid", "test"):
        (output_dir / split / "images").mkdir(parents=True, exist_ok=True)
        (output_dir / split / "labels").mkdir(parents=True, exist_ok=True)


def find_existing_dir(candidates: Iterable[Path]) -> Optional[Path]:
    for candidate in candidates:
        if candidate.exists() and candidate.is_dir():
            return candidate
    return None


def find_image_for_label(images_dir: Path, label_stem: str) -> Optional[Path]:
    if not images_dir.exists():
        return None

    for ext in IMAGE_EXTENSIONS:
        direct = images_dir / f"{label_stem}{ext}"
        if direct.exists():
            return direct

    for file in images_dir.iterdir():
        if file.is_file() and file.stem == label_stem and file.suffix.lower() in IMAGE_EXTENSIONS:
            return file
    return None


def remap_label_file(src_label_path: Path, dst_label_path: Path, mapping: Dict[int, int]) -> Tuple[int, int]:
    remapped = 0
    skipped = 0
    output_lines: List[str] = []

    with src_label_path.open("r", encoding="utf-8") as f:
        for raw_line in f:
            line = raw_line.strip()
            if not line:
                continue

            parts = line.split()
            try:
                original_class_id = int(parts[0])
            except (ValueError, IndexError):
                skipped += 1
                continue

            if original_class_id not in mapping:
                skipped += 1
                continue

            parts[0] = str(mapping[original_class_id])
            output_lines.append(" ".join(parts))
            remapped += 1

    dst_label_path.parent.mkdir(parents=True, exist_ok=True)
    with dst_label_path.open("w", encoding="utf-8", newline="\n") as f:
        if output_lines:
            f.write("\n".join(output_lines) + "\n")

    return remapped, skipped


def unique_output_stem(output_labels_dir: Path, preferred_stem: str) -> str:
    candidate = preferred_stem
    index = 1
    while (output_labels_dir / f"{candidate}.txt").exists():
        index += 1
        candidate = f"{preferred_stem}_{index}"
    return candidate


def write_data_yaml(output_dir: Path) -> None:
    yaml_path = output_dir / "data.yaml"
    lines = [
        "path: .",
        "train: train/images",
        "val: valid/images",
        "test: test/images",
        f"nc: {len(MASTER_CLASSES)}",
        "names:",
    ]
    lines.extend(f"  - {name}" for name in MASTER_CLASSES)
    yaml_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def process_dataset(dataset_root: Path, output_root: Path, config: DatasetConfig) -> Dict[str, int]:
    stats = {
        "label_files": 0,
        "images_copied": 0,
        "objects_remapped": 0,
        "objects_skipped": 0,
        "missing_images": 0,
        "missing_splits": 0,
    }

    source_dataset_dir = dataset_root / config.folder_name
    if not source_dataset_dir.exists():
        print(f"[WARN] Missing dataset directory: {source_dataset_dir}")
        return stats

    prefix = safe_prefix(config.folder_name)
    print(f"\n[INFO] Processing dataset: {config.folder_name}")

    for unified_split, aliases in SPLIT_ALIASES.items():
        labels_dir = find_existing_dir(source_dataset_dir / split / "labels" for split in aliases)
        images_dir = find_existing_dir(source_dataset_dir / split / "images" for split in aliases)

        if labels_dir is None:
            print(f"[WARN] No labels dir found for split '{unified_split}' in '{config.folder_name}'.")
            stats["missing_splits"] += 1
            continue

        label_files = sorted(labels_dir.glob("*.txt"))
        print(
            f"[INFO] Split '{unified_split}': found {len(label_files)} label file(s) "
            f"in {labels_dir.name}"
        )

        for idx, src_label in enumerate(label_files, start=1):
            preferred_stem = f"{prefix}_{src_label.stem}"
            output_labels_dir = output_root / unified_split / "labels"
            output_images_dir = output_root / unified_split / "images"
            final_stem = unique_output_stem(output_labels_dir, preferred_stem)

            dst_label = output_labels_dir / f"{final_stem}.txt"
            remapped_count, skipped_count = remap_label_file(src_label, dst_label, config.mapping)

            src_image = find_image_for_label(images_dir, src_label.stem) if images_dir else None
            if src_image is None:
                stats["missing_images"] += 1
                print(f"[WARN] Missing image for label: {src_label}")
            else:
                dst_image = output_images_dir / f"{final_stem}{src_image.suffix.lower()}"
                shutil.copy2(src_image, dst_image)
                stats["images_copied"] += 1

            stats["label_files"] += 1
            stats["objects_remapped"] += remapped_count
            stats["objects_skipped"] += skipped_count

            if idx % 200 == 0 or idx == len(label_files):
                print(
                    f"[PROGRESS] {config.folder_name} | {unified_split} "
                    f"{idx}/{len(label_files)} label files processed"
                )

    return stats


def merge_datasets(datasets_dir: Path, output_dir: Path, overwrite: bool) -> None:
    if not datasets_dir.exists() or not datasets_dir.is_dir():
        raise FileNotFoundError(f"Datasets directory not found: {datasets_dir}")

    if output_dir.exists():
        if not overwrite:
            raise FileExistsError(
                f"Output directory already exists: {output_dir}\n"
                "Use --overwrite to recreate it."
            )
        shutil.rmtree(output_dir)

    ensure_output_structure(output_dir)

    print("[WARN] Skipping excluded dataset entirely:")
    print(f"       {EXCLUDED_DATASET}")
    print("       Reason: numbered class names ('0', '1', '2') can poison unified labels.")
    print("       Action: manually inspect this folder later if needed.\n")

    grand_totals = {
        "label_files": 0,
        "images_copied": 0,
        "objects_remapped": 0,
        "objects_skipped": 0,
        "missing_images": 0,
        "missing_splits": 0,
    }

    for config in DATASET_CONFIGS:
        stats = process_dataset(datasets_dir, output_dir, config)
        for key, value in stats.items():
            grand_totals[key] += value

    write_data_yaml(output_dir)

    print("\n[INFO] Merge complete.")
    print(f"[INFO] Output dataset: {output_dir}")
    print("[INFO] Summary:")
    print(f"  - Label files processed: {grand_totals['label_files']}")
    print(f"  - Images copied:         {grand_totals['images_copied']}")
    print(f"  - Objects remapped:      {grand_totals['objects_remapped']}")
    print(f"  - Objects skipped:       {grand_totals['objects_skipped']}")
    print(f"  - Missing images:        {grand_totals['missing_images']}")
    print(f"  - Missing split dirs:    {grand_totals['missing_splits']}")


def parse_args() -> argparse.Namespace:
    script_dir = Path(__file__).resolve().parent
    default_datasets_dir = script_dir / "datasets"
    default_output_dir = script_dir / "master_dataset"

    parser = argparse.ArgumentParser(
        description=(
            "Merge multiple YOLO datasets into one master dataset with class remapping "
            "for train/valid/test splits."
        )
    )
    parser.add_argument(
        "--datasets-dir",
        type=Path,
        default=default_datasets_dir,
        help=f"Root directory containing source datasets (default: {default_datasets_dir})",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=default_output_dir,
        help=f"Output master dataset directory (default: {default_output_dir})",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Delete and recreate output directory if it already exists.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    merge_datasets(
        datasets_dir=args.datasets_dir.resolve(),
        output_dir=args.output_dir.resolve(),
        overwrite=args.overwrite,
    )


if __name__ == "__main__":
    main()