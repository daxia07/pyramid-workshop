// Only purchased stock belongs to the market. Salvaged site pieces stay usable.
export function stockRefund(state, level) {
  return level.types.reduce((sum, type) => sum + (
    Math.max(0, (state.inventory[type] || 0) - (state.freeInventory[type] || 0))
    + (state.warehouse[type] || 0)
  ) * level.prices[type], 0);
}

export function returnPurchasedStock(state, level) {
  const refund = stockRefund(state, level);
  state.money += refund;
  for (const type of level.types) {
    const kept = Math.min(state.inventory[type] || 0, state.freeInventory[type] || 0);
    state.inventory[type] = kept;
    state.freeInventory[type] = kept;
    state.warehouse[type] = 0;
  }
  // Purchases and refunds cannot be undone by a building-only snapshot.
  state.history = [];
  return refund;
}
