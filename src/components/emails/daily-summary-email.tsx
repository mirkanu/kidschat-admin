import React from "react";
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Heading,
  Text,
  Hr,
  Link,
} from "@react-email/components";

/**
 * Per-child card data rendered in the daily-summary email.
 *
 * Mirrors `DailyChildStats` (src/lib/daily-summary.ts) MINUS the raw
 * `conversationExcerpts` field — that's deliberately stripped in the
 * route before being passed to this template, because raw kid text
 * must not flow to email HTML (threat T-p94-02).
 *
 * Exception: when `alertCount > 0`, the route passes the transcript as
 * `conversationTranscript` so parents can see exactly what was said.
 */
export interface DailyChildStat {
  name: string;
  totalMessages: number;
  alertCount: number;
  summary: string;
  alertSummary: string | null;
  // Plan 21-06 / OVERSIGHT-03. Count only — the AI-paraphrased narrative is
  // woven into `summary` via summarizeChildDay. Raw query text is stripped by
  // the route (privacy T-21-06-01).
  imageSearchCount: number;
  /** Full role-prefixed chat transcript — included only when alertCount > 0. */
  conversationTranscript?: string;
}

export interface DailySummaryEmailProps {
  children: DailyChildStat[];
  date: string;
}

export function DailySummaryEmail({ children, date }: DailySummaryEmailProps) {
  const dashboardUrl =
    process.env.NEXT_PUBLIC_ADMIN_URL ??
    "https://kidschat-admin-production.up.railway.app";

  return (
    <Html lang="en">
      <Head />
      <Preview>
        Daily Summary for {date} —{" "}
        {children.length > 0
          ? `${children.length} child${children.length !== 1 ? "ren" : ""} active`
          : "No activity today"}
      </Preview>
      <Body
        style={{
          backgroundColor: "#f9fafb",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          margin: 0,
          padding: 0,
        }}
      >
        <Container
          style={{
            maxWidth: "560px",
            margin: "40px auto",
            backgroundColor: "#ffffff",
            borderRadius: "8px",
            border: "1px solid #e5e7eb",
            padding: "32px",
          }}
        >
          {/* Green heading — distinct from blue weekly and red safety */}
          <Heading
            style={{
              color: "#16a34a",
              fontSize: "22px",
              fontWeight: "700",
              margin: "0 0 4px",
            }}
          >
            Daily Summary
          </Heading>
          <Text
            style={{
              color: "#6b7280",
              fontSize: "14px",
              margin: "0 0 24px",
            }}
          >
            {date}
          </Text>

          <Hr style={{ borderColor: "#e5e7eb", margin: "0 0 24px" }} />

          {children.length === 0 ? (
            <Text
              style={{
                color: "#6b7280",
                fontSize: "14px",
                textAlign: "center",
                padding: "24px 0",
                margin: 0,
              }}
            >
              No activity today. No conversations were recorded.
            </Text>
          ) : (
            children.map((child, index) => (
              <div key={child.name}>
                <div
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: "6px",
                    padding: "16px",
                    backgroundColor: "#f9fafb",
                  }}
                >
                  {/* Child name */}
                  <Text
                    style={{
                      color: "#111827",
                      fontSize: "16px",
                      fontWeight: "700",
                      margin: "0 0 8px",
                    }}
                  >
                    {child.name}
                  </Text>

                  {/* Totals line */}
                  <Text
                    style={{
                      color: "#374151",
                      fontSize: "14px",
                      margin: "0 0 4px",
                    }}
                  >
                    {child.totalMessages} messages today
                  </Text>

                  {/* Alerts line — always shown (incl. 0) */}
                  <Text
                    style={{
                      color:
                        child.alertCount > 0 ? "#b91c1c" : "#374151",
                      fontSize: "14px",
                      fontWeight: child.alertCount > 0 ? "600" : "400",
                      margin: "0 0 4px",
                    }}
                  >
                    Alerts: {child.alertCount}
                  </Text>

                  {/* Optional AI-paraphrased alert summary */}
                  {child.alertSummary && (
                    <Text
                      style={{
                        color: "#7f1d1d",
                        fontSize: "13px",
                        fontStyle: "italic",
                        margin: "0 0 8px",
                        lineHeight: "1.4",
                      }}
                    >
                      {child.alertSummary}
                    </Text>
                  )}

                  {/* Image searches line — always shown (DL-2, Plan 21-06) */}
                  <Text
                    style={{
                      color: "#374151",
                      fontSize: "14px",
                      margin: "0 0 4px",
                    }}
                  >
                    Image searches: {child.imageSearchCount}
                  </Text>

                  {/* AI-paraphrased day summary — now weaves image-search queries inline */}
                  <Text
                    style={{
                      color: "#374151",
                      fontSize: "13px",
                      margin: "8px 0 0",
                      lineHeight: "1.5",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>Summary:</span>{" "}
                    {child.summary}
                  </Text>

                  {/* Full transcript — only when concern was flagged (set by route when alertCount>0 or summary has non-none Concerns line) */}
                  {child.conversationTranscript && (
                    <div style={{ marginTop: "16px" }}>
                      <Hr style={{ borderColor: "#fca5a5", margin: "0 0 12px" }} />
                      <Text
                        style={{
                          color: "#7f1d1d",
                          fontSize: "13px",
                          fontWeight: "700",
                          margin: "0 0 8px",
                        }}
                      >
                        Full Chat Transcript (last 24h)
                      </Text>
                      <div
                        style={{
                          backgroundColor: "#fff7f7",
                          border: "1px solid #fca5a5",
                          borderRadius: "4px",
                          padding: "12px",
                          fontFamily: "monospace",
                        }}
                      >
                        {child.conversationTranscript.split("\n").map((line, i) => {
                          const isChild = line.startsWith("[Child]:");
                          const isAI = line.startsWith("[AI]:");
                          return (
                            <Text
                              key={i}
                              style={{
                                color: isChild ? "#1d4ed8" : isAI ? "#374151" : "#6b7280",
                                fontSize: "12px",
                                margin: "0 0 4px",
                                lineHeight: "1.5",
                                fontWeight: isChild ? "600" : "400",
                              }}
                            >
                              {line}
                            </Text>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {index < children.length - 1 && (
                  <Hr
                    style={{
                      borderColor: "#e5e7eb",
                      margin: "16px 0",
                    }}
                  />
                )}
              </div>
            ))
          )}

          <Hr style={{ borderColor: "#e5e7eb", margin: "24px 0 16px" }} />

          <Link
            href={dashboardUrl}
            style={{
              display: "inline-block",
              backgroundColor: "#16a34a",
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: "600",
              textDecoration: "none",
              padding: "10px 20px",
              borderRadius: "6px",
              marginBottom: "16px",
            }}
          >
            View Dashboard
          </Link>

          <Text
            style={{
              color: "#9ca3af",
              fontSize: "12px",
              margin: 0,
            }}
          >
            This daily summary is sent automatically by KidsChat. You are
            receiving this because you have daily summary notifications enabled.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default DailySummaryEmail;
