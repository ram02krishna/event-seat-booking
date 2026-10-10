import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface SeatItem {
  id: string; // EventSeat id
  seatId: string;
  section: string;
  row: string;
  number: number;
  tier: string;
  price: number;
}

interface CartState {
  eventId: string | null;
  selectedSeats: SeatItem[];
  heldSeatIds: string[];
  holdExpiresAt: string | null;
  setEventId: (eventId: string | null) => void;
  toggleSeat: (seat: SeatItem) => { success: boolean; error?: string };
  clearSelection: () => void;
  setHeldSeats: (seatIds: string[], expiresAt: string, eventId?: string) => void;
  restoreHold: (eventId: string, seats: SeatItem[], expiresAt: string) => void;
  clearHold: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      eventId: null,
      selectedSeats: [],
      heldSeatIds: [],
      holdExpiresAt: null,

      setEventId: (eventId) => {
        const { eventId: currentEventId, heldSeatIds, holdExpiresAt } = get();
        const isHoldActive =
          heldSeatIds.length > 0 && !!holdExpiresAt && new Date(holdExpiresAt) > new Date();

        // If hold is expired, clear hold
        if (heldSeatIds.length > 0 && holdExpiresAt && new Date(holdExpiresAt) <= new Date()) {
          set({ eventId, selectedSeats: [], heldSeatIds: [], holdExpiresAt: null });
          return;
        }

        // If switching events without active hold, clear selection
        if (!isHoldActive && currentEventId && currentEventId !== eventId) {
          set({ eventId, selectedSeats: [] });
        } else {
          set({ eventId });
        }
      },

      toggleSeat: (seat) => {
        const { selectedSeats, heldSeatIds, holdExpiresAt } = get();

        // If hold is expired, clear hold
        if (heldSeatIds.length > 0 && holdExpiresAt && new Date(holdExpiresAt) <= new Date()) {
          set({ heldSeatIds: [], holdExpiresAt: null });
        } else if (heldSeatIds.length > 0) {
          return {
            success: false,
            error: 'You have active held seats. Confirm or release them first.',
          };
        }

        const exists = selectedSeats.some((s) => s.id === seat.id || s.seatId === seat.seatId);
        if (exists) {
          set({
            selectedSeats: selectedSeats.filter(
              (s) => s.id !== seat.id && s.seatId !== seat.seatId
            ),
          });
          return { success: true };
        }

        if (selectedSeats.length >= 6) {
          return { success: false, error: 'Maximum 6 seats per booking' };
        }

        set({ selectedSeats: [...selectedSeats, seat] });
        return { success: true };
      },

      clearSelection: () => set({ selectedSeats: [] }),

      setHeldSeats: (seatIds, expiresAt, eventId) =>
        set((state) => ({
          heldSeatIds: seatIds,
          holdExpiresAt: expiresAt,
          eventId: eventId || state.eventId,
        })),

      restoreHold: (eventId, seats, expiresAt) =>
        set({
          eventId,
          selectedSeats: seats,
          heldSeatIds: seats.map((s) => s.id),
          holdExpiresAt: expiresAt,
        }),

      clearHold: () =>
        set({
          selectedSeats: [],
          heldSeatIds: [],
          holdExpiresAt: null,
        }),
    }),
    {
      name: 'event-seat-cart',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
