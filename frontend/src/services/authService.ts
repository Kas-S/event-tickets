import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  GetUserCommand,
  GlobalSignOutCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import apiClient from './apiClient';

const COGNITO_REGION = import.meta.env.VITE_AWS_REGION || 'us-east-1';
const COGNITO_CLIENT_ID = import.meta.env.VITE_USER_POOL_CLIENT_ID || '';

const cognitoClient = new CognitoIdentityProviderClient({
  region: COGNITO_REGION,
});

export interface RegisterParams {
  email: string;
  password: string;
  name: string;
}

export interface LoginParams {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  idToken: string;
}

export interface User {
  userId: string;
  email: string;
  name: string;
}

class AuthService {
  async register(params: RegisterParams): Promise<void> {
    try {
      const response = await apiClient.post('/auth/register', {
        email: params.email,
        password: params.password,
        name: params.name,
      });

      return response.data;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  async signUpWithCognito(params: RegisterParams): Promise<void> {
    try {
      const command = new SignUpCommand({
        ClientId: COGNITO_CLIENT_ID,
        Username: params.email,
        Password: params.password,
        UserAttributes: [
          {
            Name: 'email',
            Value: params.email,
          },
          {
            Name: 'name',
            Value: params.name,
          },
        ],
      });

      await cognitoClient.send(command);
    } catch (error) {
      console.error('Cognito sign up error:', error);
      throw error;
    }
  }

  async confirmSignUp(email: string, code: string): Promise<void> {
    try {
      const command = new ConfirmSignUpCommand({
        ClientId: COGNITO_CLIENT_ID,
        Username: email,
        ConfirmationCode: code,
      });

      await cognitoClient.send(command);
    } catch (error) {
      console.error('Confirm sign up error:', error);
      throw error;
    }
  }

  async login(params: LoginParams): Promise<AuthTokens> {
    try {
      const response = await apiClient.post('/auth/login', {
        email: params.email,
        password: params.password,
      });

      const tokens: AuthTokens = {
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
        idToken: response.data.idToken,
      };

      this.setTokens(tokens);

      return tokens;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async loginWithCognito(params: LoginParams): Promise<AuthTokens> {
    try {
      const command = new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: COGNITO_CLIENT_ID,
        AuthParameters: {
          USERNAME: params.email,
          PASSWORD: params.password,
        },
      });

      const response = await cognitoClient.send(command);

      if (!response.AuthenticationResult) {
        throw new Error('Authentication failed');
      }

      const tokens: AuthTokens = {
        accessToken: response.AuthenticationResult.AccessToken || '',
        refreshToken: response.AuthenticationResult.RefreshToken || '',
        idToken: response.AuthenticationResult.IdToken || '',
      };

      this.setTokens(tokens);

      return tokens;
    } catch (error) {
      console.error('Cognito login error:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      const accessToken = this.getAccessToken();

      if (accessToken) {
        const command = new GlobalSignOutCommand({
          AccessToken: accessToken,
        });

        await cognitoClient.send(command);
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearTokens();
    }
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      const accessToken = this.getAccessToken();

      if (!accessToken) {
        return null;
      }

      const command = new GetUserCommand({
        AccessToken: accessToken,
      });

      const response = await cognitoClient.send(command);

      const emailAttr = response.UserAttributes?.find(attr => attr.Name === 'email');
      const nameAttr = response.UserAttributes?.find(attr => attr.Name === 'name');
      const subAttr = response.UserAttributes?.find(attr => attr.Name === 'sub');

      return {
        userId: subAttr?.Value || '',
        email: emailAttr?.Value || '',
        name: nameAttr?.Value || '',
      };
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  }

  async checkAndRefreshAuth(): Promise<boolean> {
    const idToken = this.getIdToken();
    const refreshToken = this.getRefreshToken();

    if (!idToken && !refreshToken) {
      return false;
    }

    if (!idToken && refreshToken) {
      const newToken = await this.refreshAccessToken();
      return !!newToken;
    }

    try {
      const payload = this.decodeToken(idToken || "");
      const currentTime = Math.floor(Date.now() / 1000);
      
      if (payload.exp && payload.exp < currentTime + 300) {
        if (refreshToken) {
          const newToken = await this.refreshAccessToken();
          return !!newToken;
        }
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error checking auth:', error);
      if (refreshToken) {
        const newToken = await this.refreshAccessToken();
        return !!newToken;
      }
      return false;
    }
  }

  async refreshAccessToken(): Promise<string | null> {
    try {
      const refreshToken = this.getRefreshToken();

      if (!refreshToken) {
        console.warn('No refresh token available');
        return null;
      }

      console.log('Attempting to refresh token...');

      const command = new InitiateAuthCommand({
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: COGNITO_CLIENT_ID,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
        },
      });

      const response = await cognitoClient.send(command);

      if (!response.AuthenticationResult?.IdToken) {
        console.error('No ID token in refresh response');
        return null;
      }

      const newAccessToken = response.AuthenticationResult.AccessToken || '';
      const newIdToken = response.AuthenticationResult.IdToken;

      localStorage.setItem('accessToken', newAccessToken);
      localStorage.setItem('idToken', newIdToken);

      console.log('Token refreshed successfully');
      return newIdToken;
    } catch (error) {
      console.error('Refresh token error:', error);
      this.clearTokens();
      return null;
    }
  }

  isAuthenticated(): boolean {
    const idToken = this.getIdToken();
    const refreshToken = this.getRefreshToken();
    
    if (!idToken && !refreshToken) {
      return false;
    }

    if (!idToken && refreshToken) {
      this.refreshAccessToken().catch(() => {
      });
      return true;
    }

    try {
      const payload = this.decodeToken(idToken ?? "");
      const currentTime = Math.floor(Date.now() / 1000);
      
      if (payload.exp && payload.exp < currentTime + 60) {
        if (refreshToken) {
          this.refreshAccessToken().catch(() => {
          });
          return true;
        }
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error decoding token:', error);
      return !!refreshToken;
    }
  }

  private decodeToken(token: string): { exp?: number; [key: string]: unknown } {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      throw new Error('Invalid token format');
    }
  }

  private setTokens(tokens: AuthTokens): void {
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    localStorage.setItem('idToken', tokens.idToken);
  }

  private getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  private getIdToken(): string | null {
    return localStorage.getItem('idToken');
  }

  private getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }

  private clearTokens(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('idToken');
  }
}

export default new AuthService();
