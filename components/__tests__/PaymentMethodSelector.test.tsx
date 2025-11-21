import { PaymentProviderType } from "@/lib/payments/types";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PaymentMethodSelector } from "../payment-method-selector";

// Mock the PaymentService
jest.mock("@/lib/payments/PaymentService", () => ({
  PaymentService: jest.fn().mockImplementation(() => ({
    getAvailableProviders: jest.fn().mockReturnValue([
      {
        id: "stripe",
        name: "stripe",
        displayName: "Tarjeta de Crédito/Débito",
        icon: "/icons/stripe.svg",
        description: "Pago seguro con tarjeta de crédito o débito",
        fees: "3.6% + $3 MXN",
        available: true,
        supportedMethods: ["Visa", "Mastercard", "American Express"],
      },
      {
        id: "paypal",
        name: "paypal",
        displayName: "PayPal",
        icon: "/icons/paypal.svg",
        description: "Paga con tu cuenta PayPal o tarjeta a través de PayPal",
        fees: "4.4% + $3 MXN",
        available: true,
        supportedMethods: [
          "PayPal Balance",
          "Tarjetas",
          "Transferencia bancaria",
        ],
      },
      {
        id: "mercadopago",
        name: "mercadopago",
        displayName: "MercadoPago",
        icon: "/icons/mercadopago.svg",
        description:
          "Opciones de pago mexicanas: OXXO, SPEI, tarjetas y meses sin intereses",
        fees: "3.99% + IVA",
        available: true,
        supportedMethods: ["OXXO", "SPEI", "Tarjetas", "Meses sin intereses"],
      },
    ]),
  })),
}));

describe("PaymentMethodSelector", () => {
  const defaultProps = {
    selectedProvider: null as PaymentProviderType | null,
    onProviderChange: jest.fn(),
    price: 1000,
    onPaymentInitiate: jest.fn(),
    isProcessing: false,
    error: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders all payment providers", async () => {
    render(<PaymentMethodSelector {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Tarjeta de Crédito/Débito")).toBeInTheDocument();
      expect(screen.getByText("PayPal")).toBeInTheDocument();
      expect(screen.getByText("MercadoPago")).toBeInTheDocument();
    });
  });

  test("displays provider information correctly", async () => {
    render(<PaymentMethodSelector {...defaultProps} />);

    await waitFor(() => {
      expect(
        screen.getByText("Pago seguro con tarjeta de crédito o débito")
      ).toBeInTheDocument();
      expect(screen.getByText("3.6% + $3 MXN")).toBeInTheDocument();
      expect(screen.getByText("Inmediato")).toBeInTheDocument();
    });
  });

  test("calls onProviderChange when provider is selected", async () => {
    const onProviderChange = jest.fn();
    render(
      <PaymentMethodSelector
        {...defaultProps}
        onProviderChange={onProviderChange}
      />
    );

    await waitFor(() => {
      const stripeCard = screen
        .getByText("Tarjeta de Crédito/Débito")
        .closest(".cursor-pointer");
      expect(stripeCard).toBeInTheDocument();
    });

    const stripeCard = screen
      .getByText("Tarjeta de Crédito/Débito")
      .closest(".cursor-pointer");
    fireEvent.click(stripeCard!);

    expect(onProviderChange).toHaveBeenCalledWith("stripe");
  });

  test("shows selected provider with visual indication", async () => {
    render(
      <PaymentMethodSelector {...defaultProps} selectedProvider="stripe" />
    );

    await waitFor(() => {
      const stripeCard = screen
        .getByText("Tarjeta de Crédito/Débito")
        .closest(".ring-2");
      expect(stripeCard).toBeInTheDocument();
      expect(screen.getByTestId("check-icon")).toBeInTheDocument();
    });
  });

  test("displays provider-specific information when selected", async () => {
    render(
      <PaymentMethodSelector {...defaultProps} selectedProvider="stripe" />
    );

    await waitFor(() => {
      expect(screen.getByText(/Pago con tarjeta/)).toBeInTheDocument();
      expect(
        screen.getByText(/Procesamiento inmediato y seguro/)
      ).toBeInTheDocument();
    });
  });

  test("shows PayPal-specific information when PayPal is selected", async () => {
    render(
      <PaymentMethodSelector {...defaultProps} selectedProvider="paypal" />
    );

    await waitFor(() => {
      expect(screen.getByText(/PayPal/)).toBeInTheDocument();
      expect(
        screen.getByText(/Protección al comprador incluida/)
      ).toBeInTheDocument();
    });
  });

  test("shows MercadoPago-specific information when MercadoPago is selected", async () => {
    render(
      <PaymentMethodSelector {...defaultProps} selectedProvider="mercadopago" />
    );

    await waitFor(() => {
      expect(screen.getByText(/MercadoPago/)).toBeInTheDocument();
      expect(
        screen.getByText(/Opciones de pago mexicanas/)
      ).toBeInTheDocument();
    });
  });

  test("displays payment button when provider is selected", async () => {
    render(
      <PaymentMethodSelector {...defaultProps} selectedProvider="stripe" />
    );

    await waitFor(() => {
      expect(screen.getByText("Pagar $1000.00 MXN")).toBeInTheDocument();
    });
  });

  test("calls onPaymentInitiate when payment button is clicked", async () => {
    const onPaymentInitiate = jest.fn();
    render(
      <PaymentMethodSelector
        {...defaultProps}
        selectedProvider="stripe"
        onPaymentInitiate={onPaymentInitiate}
      />
    );

    await waitFor(() => {
      const paymentButton = screen.getByText("Pagar $1000.00 MXN");
      expect(paymentButton).toBeInTheDocument();
    });

    const paymentButton = screen.getByText("Pagar $1000.00 MXN");
    fireEvent.click(paymentButton);

    expect(onPaymentInitiate).toHaveBeenCalledWith("stripe");
  });

  test("shows processing state correctly", async () => {
    render(
      <PaymentMethodSelector
        {...defaultProps}
        selectedProvider="stripe"
        isProcessing={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Procesando...")).toBeInTheDocument();
      const button = screen.getByText("Procesando...").closest("button");
      expect(button).toBeDisabled();
    });
  });

  test("displays error message when error is present", async () => {
    render(<PaymentMethodSelector {...defaultProps} error="Error de prueba" />);

    await waitFor(() => {
      expect(screen.getByText("Error de prueba")).toBeInTheDocument();
    });
  });

  test("shows loading state initially", () => {
    // Mock empty providers to simulate loading
    const { PaymentService } = await import("@/lib/payments/PaymentService");
    PaymentService.mockImplementation(() => ({
      getAvailableProviders: jest.fn().mockReturnValue([]),
    }));

    render(<PaymentMethodSelector {...defaultProps} />);

    expect(screen.getByText("Cargando métodos de pago...")).toBeInTheDocument();
  });

  test("displays supported payment methods as badges", async () => {
    render(<PaymentMethodSelector {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Visa")).toBeInTheDocument();
      expect(screen.getByText("Mastercard")).toBeInTheDocument();
      expect(screen.getByText("OXXO")).toBeInTheDocument();
      expect(screen.getByText("SPEI")).toBeInTheDocument();
    });
  });

  test('shows "Más usado" badge for popular providers', async () => {
    render(<PaymentMethodSelector {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Más usado")).toBeInTheDocument();
    });
  });

  test("handles provider selection change correctly", async () => {
    const onProviderChange = jest.fn();
    render(
      <PaymentMethodSelector
        {...defaultProps}
        onProviderChange={onProviderChange}
      />
    );

    await waitFor(() => {
      const paypalCard = screen.getByText("PayPal").closest(".cursor-pointer");
      expect(paypalCard).toBeInTheDocument();
    });

    // Select PayPal
    const paypalCard = screen.getByText("PayPal").closest(".cursor-pointer");
    fireEvent.click(paypalCard!);

    expect(onProviderChange).toHaveBeenCalledWith("paypal");
  });

  test("disables payment button when processing", async () => {
    render(
      <PaymentMethodSelector
        {...defaultProps}
        selectedProvider="stripe"
        isProcessing={true}
      />
    );

    await waitFor(() => {
      const button = screen.getByText("Procesando...").closest("button");
      expect(button).toBeDisabled();
    });
  });

  test("formats price correctly in payment button", async () => {
    render(
      <PaymentMethodSelector
        {...defaultProps}
        selectedProvider="stripe"
        price={1234.56}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Pagar $1234.56 MXN")).toBeInTheDocument();
    });
  });
});
