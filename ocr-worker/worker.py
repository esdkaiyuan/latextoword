import contextlib
import json
import os
import sys
import tempfile
from pathlib import Path


engine = None


def emit(value):
    sys.stdout.write(json.dumps(value, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def load_engine():
    global engine
    if engine is None:
        emit({"type": "progress", "stage": "自动下载或载入本地 OCR 模型", "percent": 0})
        with contextlib.redirect_stdout(sys.stderr):
            from pix2text import Pix2Text
            engine = Pix2Text.from_config(device="cpu")
        marker = os.environ.get("FORMULA_WORKBENCH_MODEL_READY")
        if marker:
            Path(marker).write_text(json.dumps({"engine": "pix2text", "version": "1.1.7"}), encoding="utf-8")
        emit({"type": "progress", "stage": "本地 OCR 模型已就绪", "percent": 100})
    return engine


def recognize_pdf(model, source):
    with tempfile.TemporaryDirectory(prefix="formula-ocr-") as output_dir:
        document = model.recognize_pdf(str(source), table_as_image=True)
        document.to_markdown(output_dir)
        markdown_files = sorted(Path(output_dir).rglob("*.md")) + sorted(Path(output_dir).rglob("*.mmd"))
        parts = [path.read_text(encoding="utf-8") for path in markdown_files]
        return "\n\n".join(part for part in parts if part.strip())


def process(request):
    source = Path(request["path"]).resolve(strict=True)
    if not source.is_file():
        raise ValueError("OCR 输入不是普通文件")
    model = load_engine()
    with contextlib.redirect_stdout(sys.stderr):
        if request.get("kind") == "pdf":
            text = recognize_pdf(model, source)
        elif request.get("kind") == "image":
            text = model.recognize_text_formula(str(source), return_text=True)
        else:
            raise ValueError("本地 OCR 输入类型不支持")
    return {"type": "result", "id": request["id"], "text": str(text or "")}


def main():
    emit({"type": "ready"})
    for line in sys.stdin:
        request = {}
        try:
            request = json.loads(line)
            emit(process(request))
        except Exception as error:  # OCR failures are returned per file; keep the worker alive.
            emit({"type": "error", "id": request.get("id"), "message": str(error)[:500]})


if __name__ == "__main__":
    main()
