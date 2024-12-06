FROM python:3.9

ENV PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=on

WORKDIR /app

COPY requirements.txt /app/requirements.txt

RUN pip install --no-cache-dir --upgrade -r /app/requirements.txt

docker run -d \
--name your-container-name \
  -p 80:80 \
  -v /path/to/your/data:/app \
  your-image-name

COPY . /app

CMD ["python", "bot.py"]
