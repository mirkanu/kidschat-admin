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

export interface AccountActivityEmailProps {
  activityType: string;
  description: string;
  performedBy: string;
  timestamp: string;
  dashboardUrl: string;
}

export function AccountActivityEmail({
  activityType,
  description,
  performedBy,
  timestamp,
  dashboardUrl,
}: AccountActivityEmailProps) {
  const formattedTime = new Date(timestamp).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <Html lang="en">
      <Head />
      <Preview>Account Activity: {activityType} by {performedBy}</Preview>
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
          {/* Orange/amber heading — distinct from red safety, blue weekly, green daily */}
          <Heading
            style={{
              color: "#d97706",
              fontSize: "22px",
              fontWeight: "700",
              margin: "0 0 4px",
            }}
          >
            Account Activity
          </Heading>
          <Text
            style={{
              color: "#6b7280",
              fontSize: "14px",
              margin: "0 0 24px",
            }}
          >
            An account event was detected on KidsChat.
          </Text>

          <Hr style={{ borderColor: "#e5e7eb", margin: "0 0 24px" }} />

          {/* Activity details */}
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
                  Event
                </td>
                <td
                  style={{
                    color: "#111827",
                    fontSize: "14px",
                    paddingBottom: "8px",
                    verticalAlign: "top",
                  }}
                >
                  {activityType}
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
                  Description
                </td>
                <td
                  style={{
                    color: "#111827",
                    fontSize: "14px",
                    paddingBottom: "8px",
                    verticalAlign: "top",
                  }}
                >
                  {description}
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
                  Performed By
                </td>
                <td
                  style={{
                    color: "#111827",
                    fontSize: "14px",
                    paddingBottom: "8px",
                    verticalAlign: "top",
                  }}
                >
                  {performedBy}
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
                  When
                </td>
                <td
                  style={{
                    color: "#111827",
                    fontSize: "14px",
                    paddingBottom: "8px",
                    verticalAlign: "top",
                  }}
                >
                  {formattedTime}
                </td>
              </tr>
            </tbody>
          </table>

          <Hr style={{ borderColor: "#e5e7eb", margin: "16px 0 24px" }} />

          <Link
            href={dashboardUrl}
            style={{
              display: "inline-block",
              backgroundColor: "#d97706",
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
            This account activity alert is sent automatically by KidsChat. You
            are receiving this because you have account activity notifications
            enabled.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default AccountActivityEmail;
