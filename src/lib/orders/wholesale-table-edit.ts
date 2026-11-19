export type WholesaleTableDraft = {
  routeName: string;
  notes: string;
  quantities: Record<string, string>;
};

export type WholesaleTableChange = {
  orderId: string;
  routeName: string;
  notes: string;
  quantities: Array<{ productName: string; value: string }>;
};

export function changedWholesaleTableRow(
  orderId: string,
  original: WholesaleTableDraft,
  draft: WholesaleTableDraft,
  productNames: string[],
): WholesaleTableChange | null {
  const quantities = productNames.flatMap((productName) => {
    const originalValue = original.quantities[productName] ?? "";
    const nextValue = draft.quantities[productName] ?? "";
    return originalValue === nextValue ? [] : [{ productName, value: nextValue }];
  });
  const routeChanged = original.routeName !== draft.routeName;
  const notesChanged = original.notes !== draft.notes;

  if (!routeChanged && !notesChanged && quantities.length === 0) return null;
  return {
    orderId,
    routeName: draft.routeName,
    notes: draft.notes,
    quantities,
  };
}
