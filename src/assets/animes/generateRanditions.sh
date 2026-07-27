#!/usr/bin/env bash
# ============================================================
# generate_renditions.sh (v2 — recursive batch mode)
#
# Drop this in the root of your video library and run it there.
# It walks every subfolder, finds every source video, and — one
# at a time — builds the missing quality renditions next to it.
#
# Usage:
#   cd /path/to/video-library-root
#   ./generate_renditions.sh
#
# Optional flags:
#   ./generate_renditions.sh --dry-run     # show what would run, do nothing
#   ./generate_renditions.sh --root /some/other/path
#   ./generate_renditions.sh --force       # re-encode even if renditions exist
#
# What it does per source video (e.g. found: some/path/master.mp4):
#   1. Creates a sibling folder named after the file, e.g.:
#         some/path/master.webm
#      becomes
#         some/path/master/144p.webm
#         some/path/master/240p.webm
#         some/path/master/360p.webm
#         some/path/master/480p.webm
#         some/path/master/720p.webm
#         some/path/master/1080p.webm  <- HARDLINKED (or copied) from the
#                                          original, never re-encoded, so
#                                          the "always 1080p, never
#                                          duplicated/re-compressed" master
#                                          stays byte-identical.
#
#   All renditions are VP9/Opus .webm — matches your source format,
#   no mp4/h264 anywhere in the pipeline.
#   2. Skips renditions that already exist, so a crashed/interrupted run
#      can just be re-run and it resumes where it left off.
#   3. Skips source files that live inside a folder already marked done
#      (.renditions_marker), so re-running the script over its own
#      output is a no-op instead of re-scanning renditions as sources.
#   4. Processes videos strictly one at a time (no parallel ffmpeg jobs)
#      to keep this safe to run on a normal desktop while you're using it.
#
# Point your <video data-video-base="..."> at the resulting
# "some/path/master/" folder for that title.
#
# Requires: ffmpeg, find, coreutils (all standard on Arch)
# ============================================================

set -uo pipefail

ROOT="."
DRY_RUN=false
FORCE=false

# ─── Argument parsing ────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --root)
      ROOT="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --force)
      FORCE=true
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

ROOT="$(realpath "$ROOT")"

# ─── Config ──────────────────────────────────────────────────────────────────
# Extensions treated as source videos to process. Locked to webm since
# renditions are always output as VP9/Opus .webm — mixing source
# containers here would just mean re-muxing headaches for no benefit.
VIDEO_EXTENSIONS=("webm")

# height : video bitrate (kbps) : audio bitrate (kbps)
declare -A LEVELS=(
  [144]="200:64"
  [240]="400:64"
  [360]="700:96"
  [480]="1200:96"
  [720]="2500:128"
)
# 1080p is intentionally NOT in LEVELS — it's hardlinked/copied from the
# master below rather than re-encoded, so the original is never duplicated
# in a lossy re-compressed form.

KEYFRAME_INTERVAL=2

# ─── Logging ─────────────────────────────────────────────────────────────────
log()  { echo "[generate_renditions] $*"; }
warn() { echo "[generate_renditions][WARN] $*" >&2; }
err()  { echo "[generate_renditions][ERROR] $*" >&2; }

# ─── Dependency check ────────────────────────────────────────────────────────
if ! command -v ffmpeg >/dev/null 2>&1; then
  err "ffmpeg not found. Install it first: sudo pacman -S ffmpeg"
  exit 1
fi
if ! command -v ffprobe >/dev/null 2>&1; then
  err "ffprobe not found (ships with ffmpeg). Install it first: sudo pacman -S ffmpeg"
  exit 1
fi

# ─── Progress bar helper ─────────────────────────────────────────────────────
# Draws a single updating line like:
#   720p [=========================>          ] 63%  00:08:12 / 00:13:02
BAR_WIDTH=36

draw_progress_bar() {
  local label="$1"
  local percent="$2"     # integer 0-100
  local current_ts="$3"  # formatted HH:MM:SS
  local total_ts="$4"    # formatted HH:MM:SS

  local filled=$(( percent * BAR_WIDTH / 100 ))
  local empty=$(( BAR_WIDTH - filled ))

  local bar=""
  [[ $filled -gt 0 ]] && bar+=$(printf '%0.s=' $(seq 1 "$filled"))
  [[ $filled -gt 0 && $empty -gt 0 ]] && bar+=">"
  [[ $empty -gt 1 ]] && bar+=$(printf '%0.s ' $(seq 1 "$((empty - 1))"))

  printf "\r  -> %-6s [%-${BAR_WIDTH}s] %3d%%  %s / %s   " \
    "$label" "$bar" "$percent" "$current_ts" "$total_ts"
}

seconds_to_hms() {
  local total="${1%.*}" # drop any decimal remainder
  printf '%02d:%02d:%02d' $((total / 3600)) $(((total % 3600) / 60)) $((total % 60))
}

# Runs ffmpeg while rendering a live progress bar for this one encode.
# Returns ffmpeg's real exit code (not the pipeline's).
run_ffmpeg_with_progress() {
  local label="$1"
  shift
  local src="$1"
  shift
  # Remaining args: the rest of the ffmpeg command (filters/codec/output).

  local duration
  duration="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$src" 2>/dev/null)"
  if [[ -z "$duration" || "$duration" == "N/A" ]]; then
    warn "  -> Could not read duration for progress display; falling back to silent encode."
    duration=0
  fi
  local total_ts
  total_ts="$(seconds_to_hms "${duration:-0}")"

  local ffmpeg_status
  # -progress pipe:1 emits machine-readable key=value progress lines on
  # stdout alongside the normal encode; -nostats suppresses ffmpeg's own
  # noisy human-readable stats so only our bar is drawn.
  ffmpeg -y -loglevel error -nostats -progress pipe:1 -i "$src" "$@" | \
  while IFS='=' read -r key value; do
    case "$key" in
      out_time_ms)
        # out_time_ms is actually microseconds despite the name (ffmpeg quirk).
        # ffmpeg can briefly emit "N/A" before decoding starts — skip those.
        if [[ "$value" =~ ^[0-9]+$ ]]; then
          local current_sec=$(( value / 1000000 ))
          local percent=0
          if [[ -n "$duration" && "$duration" != "0" ]]; then
            percent=$(awk -v c="$current_sec" -v d="$duration" 'BEGIN { p = (d > 0) ? (c / d) * 100 : 0; if (p > 100) p = 100; if (p < 0) p = 0; printf "%d", p }')
          fi
          draw_progress_bar "$label" "$percent" "$(seconds_to_hms "$current_sec")" "$total_ts"
        fi
        ;;
      progress)
        if [[ "$value" == "end" ]]; then
          draw_progress_bar "$label" 100 "$total_ts" "$total_ts"
          echo "" # move to next line once this rendition is fully done
        fi
        ;;
    esac
  done

  ffmpeg_status="${PIPESTATUS[0]}"
  return "$ffmpeg_status"
}

log "Scanning for source videos under: $ROOT"

# ─── Build the find expression for all extensions ────────────────────────────
FIND_EXPR=()
for ext in "${VIDEO_EXTENSIONS[@]}"; do
  if [[ ${#FIND_EXPR[@]} -gt 0 ]]; then
    FIND_EXPR+=(-o)
  fi
  FIND_EXPR+=(-iname "*.${ext}")
done

# Collect source files first so we know total count for progress reporting.
mapfile -d '' -t ALL_FILES < <(find "$ROOT" -type f \( "${FIND_EXPR[@]}" \) -print0)

TOTAL=${#ALL_FILES[@]}
log "Found $TOTAL candidate video file(s)."

if [[ "$TOTAL" -eq 0 ]]; then
  log "Nothing to do."
  exit 0
fi

PROCESSED=0
SKIPPED=0
INDEX=0

for SRC in "${ALL_FILES[@]}"; do
  INDEX=$((INDEX + 1))

  SRC_DIR="$(dirname "$SRC")"

  # Skip anything that lives inside a previously-generated renditions
  # folder (identified by a .renditions_marker file in that folder),
  # so re-running the script doesn't treat its own output as a new source.
  if [[ -f "$SRC_DIR/.renditions_marker" ]]; then
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  FILENAME="$(basename "$SRC")"
  BASENAME="${FILENAME%.*}"
  OUT_DIR="$SRC_DIR/$BASENAME"

  log "[$INDEX/$TOTAL] Source: $SRC"

  if [[ -d "$OUT_DIR" && -f "$OUT_DIR/.renditions_marker" && "$FORCE" == false ]]; then
    log "  -> Already fully processed (found .renditions_marker), skipping."
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  if [[ "$DRY_RUN" == true ]]; then
    log "  -> [dry-run] Would create $OUT_DIR/{144,240,360,480,720,1080}p.webm"
    continue
  fi

  mkdir -p "$OUT_DIR"

  # ── 1080p: never re-encode. Hardlink if possible (same filesystem,
  #    zero extra disk space); fall back to a real copy across filesystems.
  TARGET_1080="$OUT_DIR/1080p.webm"
  if [[ ! -f "$TARGET_1080" || "$FORCE" == true ]]; then
    log "  -> Linking master as 1080p.webm (no re-encode)"
    if ! ln "$SRC" "$TARGET_1080" 2>/dev/null; then
      warn "  -> Hardlink failed (different filesystem?) — falling back to copy."
      cp "$SRC" "$TARGET_1080"
    fi
  else
    log "  -> 1080p.webm already exists, skipping."
  fi

  # ── Lower renditions: encode one at a time, skip if already present.
  # VP9 (libvpx-vp9) video + Opus audio, matching the source container/codec
  # family instead of mp4/h264.
  #
  # Speed tuning: VP9 on CPU is inherently much slower than h264 — these
  # settings push hard toward speed over max compression efficiency, since
  # these are lower-res renditions anyway, not your archival master:
  #   -deadline realtime + -cpu-used 8  : fastest VP9 speed/quality preset
  #   -row-mt 1 -tile-columns 2 -threads 0 : spreads work across all cores
  #     (tile-columns lets libvpx actually parallelize encoding itself,
  #      not just I/O — this is the setting that matters most for speed
  #      on a 6-core/12-thread chip like the 7600)
  ENCODE_FAILED=false
  for HEIGHT in 144 240 360 480 720; do
    OUT_FILE="$OUT_DIR/${HEIGHT}p.webm"

    if [[ -f "$OUT_FILE" && "$FORCE" == false ]]; then
      log "  -> ${HEIGHT}p.webm already exists, skipping."
      continue
    fi

    IFS=":" read -r VBITRATE ABITRATE <<< "${LEVELS[$HEIGHT]}"
    log "  -> Encoding ${HEIGHT}p (VP9/Opus) ..."

    if run_ffmpeg_with_progress "${HEIGHT}p" "$SRC" \
      -vf "scale=-2:${HEIGHT}" \
      -c:v libvpx-vp9 -deadline realtime -cpu-used 8 -row-mt 1 -tile-columns 2 -threads 0 \
      -b:v "${VBITRATE}k" -maxrate "$((VBITRATE * 145 / 100))k" -bufsize "$((VBITRATE * 2))k" \
      -g "$((KEYFRAME_INTERVAL * 24))" -keyint_min "$((KEYFRAME_INTERVAL * 24))" \
      -c:a libopus -b:a "${ABITRATE}k" \
      "$OUT_FILE"; then
      log "     done: $OUT_FILE"
    else
      err "     FAILED encoding ${HEIGHT}p for $SRC"
      ENCODE_FAILED=true
      rm -f "$OUT_FILE" # don't leave a partial/corrupt file behind
    fi
  done

  if [[ "$ENCODE_FAILED" == false ]]; then
    touch "$OUT_DIR/.renditions_marker"
    PROCESSED=$((PROCESSED + 1))
    log "  -> Completed: $OUT_DIR"
  else
    warn "  -> Incomplete due to errors above; will retry on next run."
  fi
done

log "Done. Processed: $PROCESSED, Skipped (already done): $SKIPPED, Total: $TOTAL"
