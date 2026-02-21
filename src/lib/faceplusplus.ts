const FACEPLUSPLUS_API_URL = 'https://api-us.faceplusplus.com/facepp/v3';
const MIN_STRICT_FACE_THRESHOLD = 82;
const STRICT_THRESHOLD_MARGIN = 1;

interface FacePlusPlusDetectResponse {
    face_token?: string;
    faces?: Array<{ face_token: string }>;
    error_message?: string;
}

interface FacePlusPlusThresholds {
    '1e-3'?: number;
    '1e-4'?: number;
    '1e-5'?: number;
}

interface FacePlusPlusCompareResponse {
    confidence: number;
    thresholds?: FacePlusPlusThresholds;
    error_message?: string;
}

export interface FaceCompareResult {
    confidence: number;
    threshold: number;
    thresholds: FacePlusPlusThresholds | null;
}

export class FacePlusPlus {
    private apiKey: string;
    private apiSecret: string;

    constructor() {
        this.apiKey = process.env.FACEPLUSPLUS_API_KEY || '';
        this.apiSecret = process.env.FACEPLUSPLUS_API_SECRET || '';

        if (!this.apiKey || !this.apiSecret) {
            console.warn('Face++ API keys are missing');
        }
    }

    private resolveThreshold(thresholds?: FacePlusPlusThresholds): number {
        const strictApiThreshold = thresholds?.['1e-5'];

        if (typeof strictApiThreshold === 'number' && Number.isFinite(strictApiThreshold)) {
            return Math.max(
                MIN_STRICT_FACE_THRESHOLD,
                Math.ceil(strictApiThreshold + STRICT_THRESHOLD_MARGIN)
            );
        }

        return MIN_STRICT_FACE_THRESHOLD;
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

            if (data.faces && data.faces.length === 1) {
                return data.faces[0].face_token;
            }

            if (data.faces && data.faces.length > 1) {
                console.error('Face++ Detect Error: multiple faces detected during registration');
            }

            return null;
        } catch (error) {
            console.error('Face++ Detect Exception:', error);
            return null;
        }
    }

    /**
     * Compares a stored face_token with a new base64 image.
     * @param faceToken The token from registration.
     * @param imageBase64 The new image from verification.
     * @returns confidence + strict threshold to evaluate or null on error.
     */
    async compare(faceToken: string, imageBase64: string): Promise<FaceCompareResult | null> {
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
                return null;
            }

            if (typeof data.confidence !== 'number' || !Number.isFinite(data.confidence)) {
                console.error('Face++ Compare Error: invalid confidence value');
                return null;
            }

            return {
                confidence: data.confidence,
                threshold: this.resolveThreshold(data.thresholds),
                thresholds: data.thresholds ?? null,
            };
        } catch (error) {
            console.error('Face++ Compare Exception:', error);
            return null;
        }
    }
}

export const facePlusPlus = new FacePlusPlus();
