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

export interface SafetyAlertEmailProps {
  childName: string;
  alertType: "safety_redirect" | "jailbreak_attempt";
  matchedPattern: string;
  messageExcerpt: string;
  detectedAt: string;
  conversationUrl: string;
}

const ALERT_TYPE_LABELS: Record<SafetyAlertEmailProps["alertType"], string> = {
  safety_redirect: "Safety Redirect",
  jailbreak_attempt: "Jailbreak Attempt",
};

export function SafetyAlertEmail({
  childName,
  alertType,
  matchedPattern,
  messageExcerpt,
  detectedAt,
  conversationUrl,
}: SafetyAlertEmailProps) {
  const alertLabel = ALERT_TYPE_LABELS[alertType];
  const detectedDate = new Date(detectedAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <Html lang="en">
      <Head />
      <Preview>Safety Alert: {alertLabel} detected for {childName}</Preview>
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
          {/* Red alert heading */}
          <Heading
            style={{
              color: "#dc2626",
              fontSize: "22px",
              fontWeight: "700",
              margin: "0 0 4px",
            }}
          >
            Safety Alert
          </Heading>
          <Text
            style={{
              color: "#6b7280",
              fontSize: "14px",
              margin: "0 0 24px",
            }}
          >
            A safety event was detected in {childName}&apos;s conversation.
          </Text>

          <Hr style={{ borderColor: "#e5e7eb", margin: "0 0 24px" }} />

          {/* Alert details */}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td
                  style={{
                    color: "#6b7280",
                    fontSize: "13px",
                    fontWeight: "600",
                    paddingBottom: "8px",
                    width: "130px",
                    verticalAlign: "top",
                  }}
                >
                  Child
                </td>
                <td
                  style={{
                    color: "#111827",
                    fontSize: "14px",
                    paddingBottom: "8px",
                    verticalAlign: "top",
                  }}
                >
                  {childName}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    color: "#6b7280",
                    fontSize: "13px",
                    fontWeight: "600",
                    paddingBottom: "8px",
                    verticalAlign: "top",
                  }}
                >
                  Alert Type
                </td>
                <td
                  style={{
                    color: "#111827",
                    fontSize: "14px",
                    paddingBottom: "8px",
                    verticalAlign: "top",
                  }}
                >
                  {alertLabel}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    color: "#6b7280",
                    fontSize: "13px",
                    fontWeight: "600",
                    paddingBottom: "8px",
                    verticalAlign: "top",
                  }}
                >
                  Pattern Matched
                </td>
                <td
                  style={{
                    color: "#111827",
                    fontSize: "14px",
                    paddingBottom: "8px",
                    verticalAlign: "top",
                  }}
                >
                  {matchedPattern}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    color: "#6b7280",
                    fontSize: "13px",
                    fontWeight: "600",
                    paddingBottom: "8px",
                    verticalAlign: "top",
                  }}
                >
                  Detected At
                </td>
                <td
                  style={{
                    color: "#111827",
                    fontSize: "14px",
                    paddingBottom: "8px",
                    verticalAlign: "top",
                  }}
                >
                  {detectedDate}
                </td>
              </tr>
            </tbody>
          </table>

          <Hr style={{ borderColor: "#e5e7eb", margin: "16px 0" }} />

          {/* Message excerpt */}
          <Text
            style={{
              color: "#6b7280",
              fontSize: "13px",
              fontWeight: "600",
              margin: "0 0 8px",
            }}
          >
            Message Excerpt
          </Text>
          <Text
            style={{
              color: "#374151",
              fontSize: "14px",
              fontStyle: "italic",
              backgroundColor: "#f3f4f6",
              borderLeft: "3px solid #dc2626",
              padding: "10px 14px",
              borderRadius: "0 4px 4px 0",
              margin: "0 0 24px",
            }}
          >
            &quot;{messageExcerpt}&quot;
          </Text>

          {/* CTA */}
          <Link
            href={conversationUrl}
            style={{
              display: "inline-block",
              backgroundColor: "#dc2626",
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: "600",
              textDecoration: "none",
              padding: "10px 20px",
              borderRadius: "6px",
            }}
          >
            View Conversation
          </Link>

          <Hr style={{ borderColor: "#e5e7eb", margin: "24px 0 16px" }} />

          <Text
            style={{
              color: "#9ca3af",
              fontSize: "12px",
              margin: 0,
            }}
          >
            This alert was generated automatically by KidsChat. You are
            receiving this because you are an admin with safety alert
            notifications enabled.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default SafetyAlertEmail;
