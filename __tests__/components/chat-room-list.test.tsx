/**
 * Test suite for ChatRoomList component
 *
 * Tests:
 * - Chat room list display
 * - Search and filtering functionality
 * - Room selection and navigation
 * - Real-time updates
 * - Loading and error states
 * - Accessibility features
 */

import ChatRoomList from "@/components/chat/chat-room-list";
import { chatService } from "@/lib/chat-service";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionProvider } from "next-auth/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock chat service
vi.mock("@/lib/chat-service", () => ({
  chatService: {
    getActiveChatRooms: vi.fn(),
  },
}));

const mockSession = {
  user: {
    id: "user-1",
    name: "Test Patient",
    email: "patient@example.com",
    role: "PATIENT",
  },
  expires: "2024-12-31",
};

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: mockSession }),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mockChatRooms = [
  {
    id: "room-1",
    appointmentId: "apt-1",
    patientId: "user-1",
    doctorId: "doctor-1",
    isActive: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T10:00:00Z",
    appointment: {
      id: "apt-1",
      scheduledAt: new Date("2024-01-02T10:00:00Z"),
      type: "VIRTUAL",
      status: "CONFIRMED",
    },
    patient: {
      id: "user-1",
      name: "Test Patient",
      profileImage: "https://example.com/patient.jpg",
    },
    doctor: {
      id: "doctor-1",
      name: "Dr. Smith",
      specialty: "Cardiología",
      profileImage: "https://example.com/doctor.jpg",
    },
    lastMessage: {
      id: "msg-1",
      content: "Hello, how are you feeling today?",
      messageType: "TEXT",
      sentAt: new Date("2024-01-01T10:00:00Z"),
      senderName: "Dr. Smith",
    },
    unreadCount: 2,
  },
  {
    id: "room-2",
    appointmentId: "apt-2",
    patientId: "user-1",
    doctorId: "doctor-2",
    isActive: false,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T09:00:00Z",
    appointment: {
      id: "apt-2",
      scheduledAt: new Date("2024-01-01T14:00:00Z"),
      type: "IN_PERSON",
      status: "COMPLETED",
    },
    patient: {
      id: "user-1",
      name: "Test Patient",
    },
    doctor: {
      id: "doctor-2",
      name: "Dr. Johnson",
      specialty: "Dermatología",
    },
    lastMessage: {
      id: "msg-2",
      content: "Thank you for the consultation",
      messageType: "TEXT",
      sentAt: new Date("2024-01-01T09:00:00Z"),
      senderName: "Test Patient",
    },
    unreadCount: 0,
  },
  {
    id: "room-3",
    appointmentId: "apt-3",
    patientId: "user-1",
    doctorId: "doctor-3",
    isActive: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T11:00:00Z",
    appointment: {
      id: "apt-3",
      scheduledAt: new Date("2024-01-03T16:00:00Z"),
      type: "HOME_VISIT",
      status: "PENDING",
    },
    patient: {
      id: "user-1",
      name: "Test Patient",
    },
    doctor: {
      id: "doctor-3",
      name: "Dr. Williams",
      specialty: "Medicina General",
    },
    lastMessage: undefined,
    unreadCount: 0,
  },
];

describe("ChatRoomList Component", () => {
  const defaultProps = {
    onSelectChatRoom: vi.fn(),
    selectedChatRoomId: undefined,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(chatService.getActiveChatRooms).mockResolvedValue(
      mockChatRooms
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderChatRoomList = (props = {}) => {
    return render(
      <SessionProvider session={mockSession}>
        <ChatRoomList {...defaultProps} {...props} />
      </SessionProvider>
    );
  };

  describe("Basic Rendering", () => {
    it("should render chat room list with header", async () => {
      renderChatRoomList();

      expect(screen.getByText("Chats")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Buscar chats...")
      ).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText("Dr. Smith")).toBeInTheDocument();
      });
    });

    it("should show loading state initially", () => {
      renderChatRoomList();

      expect(screen.getByText("Cargando chats...")).toBeInTheDocument();
      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });

    it("should show total unread count in header", async () => {
      renderChatRoomList();

      await waitFor(() => {
        expect(screen.getByText("2")).toBeInTheDocument(); // Total unread count
      });
    });
  });

  describe("Chat Room Items", () => {
    it("should display chat room information correctly", async () => {
      renderChatRoomList();

      await waitFor(() => {
        // Should show doctor name and specialty
        expect(screen.getByText("Dr. Smith")).toBeInTheDocument();
        expect(screen.getByText("Cardiología")).toBeInTheDocument();

        // Should show last message
        expect(
          screen.getByText("Hello, how are you feeling today?")
        ).toBeInTheDocument();

        // Should show unread count
        expect(screen.getByText("2")).toBeInTheDocument();

        // Should show appointment info
        expect(
          screen.getByText(/Cita: 02\/01\/2024 10:00/)
        ).toBeInTheDocument();
      });
    });

    it("should show different icons for appointment types", async () => {
      renderChatRoomList();

      await waitFor(() => {
        // Virtual appointment should show video icon
        const virtualRoom = screen
          .getByText("Dr. Smith")
          .closest('[role="button"]');
        expect(
          within(virtualRoom!).getByTestId("video-icon")
        ).toBeInTheDocument();

        // In-person appointment should show message icon
        const inPersonRoom = screen
          .getByText("Dr. Johnson")
          .closest('[role="button"]');
        expect(
          within(inPersonRoom!).getByTestId("message-icon")
        ).toBeInTheDocument();

        // Home visit should show phone icon
        const homeVisitRoom = screen
          .getByText("Dr. Williams")
          .closest('[role="button"]');
        expect(
          within(homeVisitRoom!).getByTestId("phone-icon")
        ).toBeInTheDocument();
      });
    });

    it("should show status icons for appointments", async () => {
      renderChatRoomList();

      await waitFor(() => {
        // Confirmed appointment should show green check
        const confirmedRoom = screen
          .getByText("Dr. Smith")
          .closest('[role="button"]');
        expect(
          within(confirmedRoom!).getByTestId("confirmed-icon")
        ).toBeInTheDocument();

        // Completed appointment should show blue check
        const completedRoom = screen
          .getByText("Dr. Johnson")
          .closest('[role="button"]');
        expect(
          within(completedRoom!).getByTestId("completed-icon")
        ).toBeInTheDocument();

        // Pending appointment should show yellow clock
        const pendingRoom = screen
          .getByText("Dr. Williams")
          .closest('[role="button"]');
        expect(
          within(pendingRoom!).getByTestId("pending-icon")
        ).toBeInTheDocument();
      });
    });

    it("should show active indicator for active rooms", async () => {
      renderChatRoomList();

      await waitFor(() => {
        const activeRoom = screen
          .getByText("Dr. Smith")
          .closest('[role="button"]');
        expect(
          within(activeRoom!).getByTestId("active-indicator")
        ).toBeInTheDocument();
      });
    });

    it("should handle rooms without last message", async () => {
      renderChatRoomList();

      await waitFor(() => {
        expect(screen.getByText("No hay mensajes")).toBeInTheDocument();
      });
    });

    it("should truncate long messages", async () => {
      const longMessageRoom = {
        ...mockChatRooms[0],
        lastMessage: {
          ...mockChatRooms[0].lastMessage!,
          content:
            "This is a very long message that should be truncated because it exceeds the maximum length allowed for display in the chat room list",
        },
      };

      vi.mocked(chatService.getActiveChatRooms).mockResolvedValue(
        [longMessageRoom]
      );

      renderChatRoomList();

      await waitFor(() => {
        expect(
          screen.getByText(
            /This is a very long message that should be truncated.../
          )
        ).toBeInTheDocument();
      });
    });

    it("should show file type indicators for file messages", async () => {
      const fileMessageRoom = {
        ...mockChatRooms[0],
        lastMessage: {
          ...mockChatRooms[0].lastMessage!,
          messageType: "FILE",
          content: "Shared a document",
        },
      };

      vi.mocked(chatService.getActiveChatRooms).mockResolvedValue(
        [fileMessageRoom]
      );

      renderChatRoomList();

      await waitFor(() => {
        expect(screen.getByText("📎 Archivo")).toBeInTheDocument();
      });
    });

    it("should show image indicator for image messages", async () => {
      const imageMessageRoom = {
        ...mockChatRooms[0],
        lastMessage: {
          ...mockChatRooms[0].lastMessage!,
          messageType: "IMAGE",
          content: "Shared an image",
        },
      };

      vi.mocked(chatService.getActiveChatRooms).mockResolvedValue(
        [imageMessageRoom]
      );

      renderChatRoomList();

      await waitFor(() => {
        expect(screen.getByText("📷 Imagen")).toBeInTheDocument();
      });
    });
  });

  describe("Room Selection", () => {
    it("should call onSelectChatRoom when room is clicked", async () => {
      const onSelectChatRoom = vi.fn();
      renderChatRoomList({ onSelectChatRoom });

      await waitFor(() => {
        const roomItem = screen
          .getByText("Dr. Smith")
          .closest('[role="button"]');
        fireEvent.click(roomItem!);
      });

      expect(onSelectChatRoom).toHaveBeenCalledWith(mockChatRooms[0]);
    });

    it("should highlight selected room", async () => {
      renderChatRoomList({ selectedChatRoomId: "room-1" });

      await waitFor(() => {
        const selectedRoom = screen
          .getByText("Dr. Smith")
          .closest('[role="button"]');
        expect(selectedRoom).toHaveClass(
          "bg-muted",
          "border-l-4",
          "border-l-primary"
        );
      });
    });
  });

  describe("Search Functionality", () => {
    it("should filter rooms by doctor name", async () => {
      const user = userEvent.setup();
      renderChatRoomList();

      await waitFor(() => {
        expect(screen.getByText("Dr. Smith")).toBeInTheDocument();
        expect(screen.getByText("Dr. Johnson")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Buscar chats...");
      await user.type(searchInput, "Smith");

      await waitFor(() => {
        expect(screen.getByText("Dr. Smith")).toBeInTheDocument();
        expect(screen.queryByText("Dr. Johnson")).not.toBeInTheDocument();
      });
    });

    it("should filter rooms by message content", async () => {
      const user = userEvent.setup();
      renderChatRoomList();

      await waitFor(() => {
        expect(
          screen.getByText("Hello, how are you feeling today?")
        ).toBeInTheDocument();
        expect(
          screen.getByText("Thank you for the consultation")
        ).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Buscar chats...");
      await user.type(searchInput, "consultation");

      await waitFor(() => {
        expect(
          screen.queryByText("Hello, how are you feeling today?")
        ).not.toBeInTheDocument();
        expect(
          screen.getByText("Thank you for the consultation")
        ).toBeInTheDocument();
      });
    });

    it("should show no results message when search yields no matches", async () => {
      const user = userEvent.setup();
      renderChatRoomList();

      const searchInput = screen.getByPlaceholderText("Buscar chats...");
      await user.type(searchInput, "nonexistent");

      await waitFor(() => {
        expect(
          screen.getByText("No se encontraron chats con los filtros aplicados")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Filtering", () => {
    it("should show filter options when filter button is clicked", async () => {
      const user = userEvent.setup();
      renderChatRoomList();

      const filterButton = screen.getByRole("button", { name: /filter/i });
      await user.click(filterButton);

      expect(screen.getByText("Estado")).toBeInTheDocument();
      expect(screen.getByText("Tipo")).toBeInTheDocument();
      expect(screen.getByText("Solo no leídos")).toBeInTheDocument();
    });

    it("should filter by active status", async () => {
      const user = userEvent.setup();
      renderChatRoomList();

      // Open filters
      const filterButton = screen.getByRole("button", { name: /filter/i });
      await user.click(filterButton);

      // Select active only
      const statusSelect = screen.getByDisplayValue("Todos");
      await user.selectOptions(statusSelect, "active");

      await waitFor(() => {
        expect(screen.getByText("Dr. Smith")).toBeInTheDocument();
        expect(screen.getByText("Dr. Williams")).toBeInTheDocument();
        expect(screen.queryByText("Dr. Johnson")).not.toBeInTheDocument();
      });
    });

    it("should filter by appointment type", async () => {
      const user = userEvent.setup();
      renderChatRoomList();

      // Open filters
      const filterButton = screen.getByRole("button", { name: /filter/i });
      await user.click(filterButton);

      // Select virtual only
      const typeSelect = screen.getByDisplayValue("Todos");
      await user.selectOptions(typeSelect, "VIRTUAL");

      await waitFor(() => {
        expect(screen.getByText("Dr. Smith")).toBeInTheDocument();
        expect(screen.queryByText("Dr. Johnson")).not.toBeInTheDocument();
        expect(screen.queryByText("Dr. Williams")).not.toBeInTheDocument();
      });
    });

    it("should filter by unread messages only", async () => {
      const user = userEvent.setup();
      renderChatRoomList();

      // Open filters
      const filterButton = screen.getByRole("button", { name: /filter/i });
      await user.click(filterButton);

      // Check unread only
      const unreadCheckbox = screen.getByLabelText("Solo no leídos");
      await user.click(unreadCheckbox);

      await waitFor(() => {
        expect(screen.getByText("Dr. Smith")).toBeInTheDocument();
        expect(screen.queryByText("Dr. Johnson")).not.toBeInTheDocument();
        expect(screen.queryByText("Dr. Williams")).not.toBeInTheDocument();
      });
    });

    it("should clear all filters", async () => {
      const user = userEvent.setup();
      renderChatRoomList();

      // Apply filters first
      const filterButton = screen.getByRole("button", { name: /filter/i });
      await user.click(filterButton);

      const unreadCheckbox = screen.getByLabelText("Solo no leídos");
      await user.click(unreadCheckbox);

      // Should show filtered results
      await waitFor(() => {
        expect(screen.queryByText("Dr. Johnson")).not.toBeInTheDocument();
      });

      // Clear filters
      const clearButton = screen.getByText("Limpiar filtros");
      await user.click(clearButton);

      await waitFor(() => {
        expect(screen.getByText("Dr. Smith")).toBeInTheDocument();
        expect(screen.getByText("Dr. Johnson")).toBeInTheDocument();
        expect(screen.getByText("Dr. Williams")).toBeInTheDocument();
      });
    });
  });

  describe("Sorting", () => {
    it("should sort rooms by last message time (most recent first)", async () => {
      renderChatRoomList();

      await waitFor(() => {
        const roomItems = screen.getAllByRole("button");
        const firstRoom = within(roomItems[0]).getByText("Dr. Williams"); // Most recent (11:00)
        const secondRoom = within(roomItems[1]).getByText("Dr. Smith"); // Second (10:00)
        const thirdRoom = within(roomItems[2]).getByText("Dr. Johnson"); // Oldest (09:00)

        expect(firstRoom).toBeInTheDocument();
        expect(secondRoom).toBeInTheDocument();
        expect(thirdRoom).toBeInTheDocument();
      });
    });
  });

  describe("Error Handling", () => {
    it("should show error state when API call fails", async () => {
      const errorMessage = "Failed to load chat rooms";
      vi.mocked(chatService.getActiveChatRooms).mockRejectedValue(
        new Error(errorMessage)
      );

      renderChatRoomList();

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
        expect(screen.getByText("Reintentar")).toBeInTheDocument();
      });
    });

    it("should retry loading when retry button is clicked", async () => {
      const user = userEvent.setup();
      vi.mocked(chatService.getActiveChatRooms)
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce(
          mockChatRooms
        );

      renderChatRoomList();

      await waitFor(() => {
        expect(screen.getByText("Network error")).toBeInTheDocument();
      });

      const retryButton = screen.getByText("Reintentar");
      await user.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText("Dr. Smith")).toBeInTheDocument();
      });
    });
  });

  describe("Empty States", () => {
    it("should show empty state when no chat rooms exist", async () => {
      vi.mocked(chatService.getActiveChatRooms).mockResolvedValue(
        []
      );

      renderChatRoomList();

      await waitFor(() => {
        expect(screen.getByText("No tienes chats activos")).toBeInTheDocument();
      });
    });

    it("should show filtered empty state when filters yield no results", async () => {
      const user = userEvent.setup();
      renderChatRoomList();

      const searchInput = screen.getByPlaceholderText("Buscar chats...");
      await user.type(searchInput, "nonexistent");

      await waitFor(() => {
        expect(
          screen.getByText("No se encontraron chats con los filtros aplicados")
        ).toBeInTheDocument();
        expect(screen.getByText("Limpiar filtros")).toBeInTheDocument();
      });
    });
  });

  describe("Auto-refresh", () => {
    it("should auto-refresh chat rooms every 30 seconds", async () => {
      vi.useFakeTimers();
      renderChatRoomList();

      // Initial load
      expect(chatService.getActiveChatRooms).toHaveBeenCalledTimes(1);

      // Fast-forward 30 seconds
      vi.advanceTimersByTime(30000);

      await waitFor(() => {
        expect(chatService.getActiveChatRooms).toHaveBeenCalledTimes(2);
      });

      vi.useRealTimers();
    });

    it("should stop auto-refresh when component unmounts", () => {
      vi.useFakeTimers();
      const { unmount } = renderChatRoomList();

      unmount();

      // Fast-forward 30 seconds
      vi.advanceTimersByTime(30000);

      // Should not call API after unmount
      expect(chatService.getActiveChatRooms).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels and roles", async () => {
      renderChatRoomList();

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText("Buscar chats...");
        expect(searchInput).toHaveAttribute("type", "text");

        const roomItems = screen.getAllByRole("button");
        expect(roomItems.length).toBeGreaterThan(0);
      });
    });

    it("should support keyboard navigation", async () => {
      const user = userEvent.setup();
      renderChatRoomList();

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText("Buscar chats...");

        // Tab should focus the search input
        user.tab();
        expect(searchInput).toHaveFocus();
      });
    });

    it("should announce unread count to screen readers", async () => {
      renderChatRoomList();

      await waitFor(() => {
        const unreadBadge = screen.getByText("2");
        expect(unreadBadge).toHaveAttribute(
          "aria-label",
          expect.stringContaining("2")
        );
      });
    });
  });

  describe("Performance", () => {
    it("should handle large number of chat rooms efficiently", async () => {
      const manyChatRooms = Array.from({ length: 100 }, (_, i) => ({
        ...mockChatRooms[0],
        id: `room-${i}`,
        doctor: {
          ...mockChatRooms[0].doctor!,
          name: `Dr. Test ${i}`,
        },
      }));

      vi.mocked(chatService.getActiveChatRooms).mockResolvedValue(
        manyChatRooms
      );

      const startTime = performance.now();
      renderChatRoomList();

      await waitFor(() => {
        expect(screen.getByText("Dr. Test 0")).toBeInTheDocument();
      });

      const endTime = performance.now();

      // Should render within reasonable time (less than 200ms)
      expect(endTime - startTime).toBeLessThan(200);
    });

    it("should debounce search input", async () => {
      vi.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderChatRoomList();

      const searchInput = screen.getByPlaceholderText("Buscar chats...");

      // Type multiple characters quickly
      await user.type(searchInput, "test");

      // Should not filter immediately
      expect(screen.getByText("Dr. Smith")).toBeInTheDocument();

      // Fast-forward debounce time
      vi.advanceTimersByTime(300);

      // Should filter after debounce
      await waitFor(() => {
        // Assuming no rooms match 'test'
        expect(screen.queryByText("Dr. Smith")).not.toBeInTheDocument();
      });

      vi.useRealTimers();
    });
  });
});
