import apiClient from './apiClient';

export interface PresignedUrlResponse {
  uploadUrl: string;
  fileKey: string;
  publicUrl: string;
}

class UploadService {
  async getPresignedUrl(fileName: string, fileType: string): Promise<PresignedUrlResponse> {
    try {
      const response = await apiClient.post<PresignedUrlResponse>('/uploads/presigned-url', {
        fileName,
        fileType,
      });
      return response.data;
    } catch (error) {
      console.error('Get presigned URL error:', error);
      throw error;
    }
  }

  async uploadFile(file: File): Promise<string> {
    try {
      const { uploadUrl, publicUrl } = await this.getPresignedUrl(file.name, file.type);

      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      return publicUrl;
    } catch (error) {
      console.error('Upload file error:', error);
      throw error;
    }
  }

  async uploadCoverPhoto(file: File): Promise<string> {
    return this.uploadFile(file);
  }
}

export default new UploadService();
