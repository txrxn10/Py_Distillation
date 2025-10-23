FROM python:3.12-slim

# Install required packages
RUN apt-get update && apt-get install -y ffmpeg \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /api

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the pre-downloaded YOLO model into the image so it's always available
COPY yolov8n.pt /api/yolov8n.pt

# Copy application code
COPY . .

# Create directory for service account
RUN mkdir -p /app

# Expose port for Flask development server
EXPOSE 5000

# Set environment variables for Flask and unbuffered output
ENV FLASK_ENV=development
ENV PYTHONUNBUFFERED=1

# Start Flask development server using run.py
CMD ["python", "run.py"]