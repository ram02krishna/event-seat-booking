import { create } from 'zustand';

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
  selectedSeats: SeatItem[];
  heldSeatIds: string[];
  holdExpiresAt: string | null;
  toggleSeat: (seat: SeatItem) => { success: boolean; error?: string };
  clearSelection: () => void;
  setHeldSeats: (seatIds: string[], expiresAt: string) => void;
  clearHold: () => void;
}

export const useCartStore = create<CartState>((set, get) => ({
  selectedSeats: [],
  heldSeatIds: [],
  holdExpiresAt: null,

  toggleSeat: (seat) => {
    const { selectedSeats, heldSeatIds } = get();

    // If seats are currently held, user must release or confirm first
    if (heldSeatIds.length > 0) {
      return { success: false, error: 'You have active held seats. Confirm or release them first.' };
    }

    const exists = selectedSeats.some((s) => s.id === seat.id);
    if (exists) {
      set({ selectedSeats: selectedSeats.filter((s) => s.id !== seat.id) });
      return { success: true };
    }

    if (selectedSeats.length >= 6) {
      return { success: false, error: 'Maximum 6 seats per booking' };
    }

    set({ selectedSeats: [...selectedSeats, seat] });
    return { success: true };
  },

  clearSelection: () => set({ selectedSeats: [] }),

  setHeldSeats: (seatIds, expiresAt) =>
    set({
      heldSeatIds: seatIds,
      holdExpiresAt: expiresAt,
    }),

  clearHold: () =>
    set({
      selectedSeats: [],
      heldSeatIds: [],
      holdExpiresAt: null,
    }),
}));
