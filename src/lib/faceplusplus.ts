
const FACEPLUSPLUS_API_URL = 'https://api-us.faceplusplus.com/facepp/v3';

interface FacePlusPlusDetectResponse {
    face_token?: string;
    faces?: Array<{ face_token: string }>;
    error_message?: string;
}

interface FacePlusPlusCompareResponse {
    confidence: number;
    thresholds?: {
        '1e-3': number;
        '1e-4': number;
        '1e-5': number;
    };
    error_message?: string;
}

export class FacePlusPlus {
    private apiKey: string;
    private apiSecret: string;

    constructor() {
        this.apiKey = process.env.FACEPLUSPLUS_API_KEY || '';
        this.apiSecret = process.env.FACEPLUSPLUS_API_SECRET || '';

        if (!this.apiKey || !this.apiSecret) {
            console.warn('⚠️ Face++ API keys are missing!');
        }
    }

    /**
     * Detects a face in a base64 image and returns the face_token.
     */
    async detect(imageBase64: string): Promise<string | null> {
        try {
            const formData = new FormData();
            formData.append('api_key', this.apiKey);
            formData.append('api_secret', this.apiSecret);
            formData.append('image_base64', imageBase64.replace(/^data:image\/\w+;base64,/, ''));
            formData.append('return_landmark', '0');
            formData.append('return_attributes', 'none');

            const response = await fetch(`${FACEPLUSPLUS_API_URL}/detect`, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json() as FacePlusPlusDetectResponse;

            if (data.error_message) {
                console.error('Face++ Detect Error:', data.error_message);
                return null;
            }

            if (data.faces && data.faces.length > 0) {
                return data.faces[0].face_token;
            }

            return null; // No face detected
        } catch (error) {
            console.error('Face++ Detect Exception:', error);
            return null;
        }
    }

    /**
     * Compares a stored face_token with a new base64 image.
     * @param faceToken The token from registration.
     * @param imageBase64 The new image from verification.
     * @returns confidence score (0-100) or -1 on error.
     */
    async compare(faceToken: string, imageBase64: string): Promise<number> {
        try {
            const formData = new FormData();
            formData.append('api_key', this.apiKey);
            formData.append('api_secret', this.apiSecret);
            formData.append('face_token1', faceToken);
            formData.append('image_base64_2', imageBase64.replace(/^data:image\/\w+;base64,/, ''));

            const response = await fetch(`${FACEPLUSPLUS_API_URL}/compare`, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json() as FacePlusPlusCompareResponse;

            if (data.error_message) {
                console.error('Face++ Compare Error:', data.error_message);
                return -1;
            }

            return data.confidence;
        } catch (error) {
            console.error('Face++ Compare Exception:', error);
            return -1;
        }
    }
}

export const facePlusPlus = new FacePlusPlus();
