// MercadoPago API client with error handling

interface MercadoPagoConfig {
  accessToken: string;
  publicKey: string;
}

export class MercadoPagoClient {
  private config: MercadoPagoConfig;
  private baseUrl: string = "https://api.mercadopago.com";

  constructor(config: MercadoPagoConfig) {
    this.config = config;
  }

  async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Idempotency-Key": this.generateIdempotencyKey(),
        ...options.headers,
      },
    });

    const responseData = await response.json();

    if (!response.ok) {
      throw new MercadoPagoError(responseData, response.status);
    }

    return responseData;
  }

  private generateIdempotencyKey(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export class MercadoPagoError extends Error {
  public readonly statusCode: number;
  public readonly details: any;

  constructor(errorData: any, statusCode: number) {
    const message =
      errorData.message || errorData.error || "MercadoPago API error";
    super(message);
    this.name = "MercadoPagoError";
    this.statusCode = statusCode;
    this.details = errorData;
  }
}
