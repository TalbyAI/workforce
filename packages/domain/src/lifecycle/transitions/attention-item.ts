import { Effect, type DateTime } from "effect";

import type { AttentionItemId } from "../../ids";
import { AttentionItemNotOpen } from "../errors";
import { AttentionItemOpened, AttentionItemResolved } from "../facts";
import type { AttentionItemKind, TaskLifecycleState } from "../state";
import type { DomainTransition } from "./shared";

export type OpenAttentionItemIntent = Readonly<{
  kind: AttentionItemKind;
  openedAt: DateTime.Utc;
}>;

export type ResolveAttentionItemIntent = Readonly<{
  attentionItemId: AttentionItemId;
}>;

export const openAttentionItem = (
  state: TaskLifecycleState,
  intent: OpenAttentionItemIntent
): DomainTransition =>
  Effect.succeed({
    nextState: {
      ...state,
      pendingAttentionItems: [
        ...state.pendingAttentionItems,
        {
          kind: intent.kind,
          openedAt: intent.openedAt,
          status: "open"
        }
      ]
    },
    facts: [
      new AttentionItemOpened({
        taskId: state.taskId,
        kind: intent.kind
      })
    ]
  });

export const resolveAttentionItem = (
  state: TaskLifecycleState,
  intent: ResolveAttentionItemIntent
): DomainTransition => {
  const attentionItem = state.attentionItems.find(
    (item) => item.id === intent.attentionItemId
  );

  if (attentionItem?.status !== "open") {
    return Effect.fail(new AttentionItemNotOpen());
  }

  return Effect.succeed({
    nextState: {
      ...state,
      attentionItems: state.attentionItems.map((item) =>
        item.id === intent.attentionItemId
          ? {
              ...item,
              status: "resolved"
            }
          : item
      )
    },
    facts: [
      new AttentionItemResolved({
        taskId: state.taskId,
        attentionItemId: intent.attentionItemId
      })
    ]
  });
};
