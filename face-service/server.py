from flask import Flask, request, jsonify
from deepface import DeepFace
import base64
import tempfile
import os

app = Flask(__name__)

@app.route('/verify', methods=['POST'])
def verify_faces():
    """Compare two face images and return verification result."""
    try:
        data = request.get_json()
        image1_b64 = data.get('image1')  # Base64 encoded webcam capture
        image2_path = data.get('image2')  # Path to government photo or base64

        if not image1_b64 or not image2_path:
            return jsonify({'error': 'Two images are required'}), 400

        # Save base64 image to temp file
        img1_data = base64.b64decode(image1_b64.split(',')[1] if ',' in image1_b64 else image1_b64)
        
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as f1:
            f1.write(img1_data)
            img1_path = f1.name

        # Handle image2 - could be base64 or file path
        if image2_path.startswith('data:') or image2_path.startswith('/9j'):
            img2_data = base64.b64decode(image2_path.split(',')[1] if ',' in image2_path else image2_path)
            with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as f2:
                f2.write(img2_data)
                img2_path = f2.name
        else:
            img2_path = image2_path

        try:
            result = DeepFace.verify(
                img1_path=img1_path,
                img2_path=img2_path,
                model_name='VGG-Face',
                enforce_detection=False
            )
            
            return jsonify({
                'verified': result['verified'],
                'distance': result['distance'],
                'threshold': result['threshold'],
                'model': result['model'],
            })
        finally:
            # Clean up temp files
            if os.path.exists(img1_path):
                os.unlink(img1_path)
            if img2_path != image2_path and os.path.exists(img2_path):
                os.unlink(img2_path)

    except Exception as e:
        return jsonify({'error': str(e), 'verified': False}), 500


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'service': 'DeepFace Verification'})


if __name__ == '__main__':
    print('🔍 DeepFace Verification Service starting on port 5001...')
    app.run(host='0.0.0.0', port=5001, debug=True)
