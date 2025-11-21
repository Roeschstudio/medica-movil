// PayPal API client with access token management and error handling

interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  mode: "sandbox" | "live";
}

interface PayPalAccessToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at: number;
}

export class PayPalClient {
  private config: PayPalConfig;
  private accessToken: PayPalAccessToken | null = null;
  private baseUrl: string;

  constructor(config: PayPalConfig) {
    this.config = config;
    this.baseUrl =
      config.mode === "sandbox"
        ? "https://api-m.sandbox.paypal.com"
        : "https://api-m.paypal.com";
  }

  private async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && this.accessToken.expires_at > Date.now()) {
      return this.accessToken.access_token;
    }

    // Request new access token
    const auth = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`
    ).toString("base64");

    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`PayPal authentication failed: ${error}`);
    }

    const tokenData = await response.json();
    this.accessToken = {
      ...tokenData,
      expires_at: Date.now() + tokenData.expires_in * 1000 - 60000, // Subtract 1 minute for safety
    };

    return this.accessToken.access_token;
  }

  async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "PayPal-Request-Id": this.generateRequestId(),
        ...options.headers,
      },
    });

    const responseData = await response.json();

    if (!response.ok) {
      throw new PayPalError(responseData, response.status);
    }

    return responseData;
  }

  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export class PayPalError extends Error {
  public readonly statusCode: number;
  public readonly details: any;

  constructor(errorData: any, statusCode: number) {
    const message =
      errorData.message || errorData.error_description || "PayPal API error";
    super(message);
    this.name = "PayPalError";
    this.statusCode = statusCode;
    this.details = errorData;
  }
}
