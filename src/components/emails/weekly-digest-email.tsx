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
} from "@react-email/components";

export interface ChildWeeklyStat {
  name: string;
  totalMessages: number;
  activeDays: number;
  topPresets: string[];
}

export interface WeeklyDigestEmailProps {
  children: ChildWeeklyStat[];
  weekOf: string;
}

export function WeeklyDigestEmail({ children, weekOf }: WeeklyDigestEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>
        Weekly Activity Summary for {weekOf} —{" "}
        {children.length > 0
          ? `${children.length} child${children.length !== 1 ? "ren" : ""} active`
          : "No activity this week"}
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
          {/* Blue heading */}
          <Heading
            style={{
              color: "#2563eb",
              fontSize: "22px",
              fontWeight: "700",
              margin: "0 0 4px",
            }}
          >
            Weekly Activity Summary
          </Heading>
          <Text
            style={{
              color: "#6b7280",
              fontSize: "14px",
              margin: "0 0 24px",
            }}
          >
            Week of {weekOf}
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
              No activity this week. No conversations were recorded.
            </Text>
          ) : (
            children.map((child, index) => (
              <div key={child.name}>
                {/* Child name */}
                <Text
                  style={{
                    color: "#111827",
                    fontSize: "16px",
                    fontWeight: "700",
                    margin: "0 0 12px",
                  }}
                >
                  {child.name}
                </Text>

                {/* Stats table */}
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    backgroundColor: "#f9fafb",
                    borderRadius: "6px",
                    marginBottom: "8px",
                  }}
                >
                  <thead>
                    <tr>
                      <th
                        style={{
                          color: "#6b7280",
                          fontSize: "12px",
                          fontWeight: "600",
                          textAlign: "left",
                          padding: "8px 12px",
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        Messages
                      </th>
                      <th
                        style={{
                          color: "#6b7280",
                          fontSize: "12px",
                          fontWeight: "600",
                          textAlign: "left",
                          padding: "8px 12px",
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        Active Days
                      </th>
                      <th
                        style={{
                          color: "#6b7280",
                          fontSize: "12px",
                          fontWeight: "600",
                          textAlign: "left",
                          padding: "8px 12px",
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        Top Presets
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td
                        style={{
                          color: "#111827",
                          fontSize: "14px",
                          fontWeight: "600",
                          padding: "10px 12px",
                        }}
                      >
                        {child.totalMessages}
                      </td>
                      <td
                        style={{
                          color: "#111827",
                          fontSize: "14px",
                          padding: "10px 12px",
                        }}
                      >
                        {child.activeDays}
                      </td>
                      <td
                        style={{
                          color: "#374151",
                          fontSize: "13px",
                          padding: "10px 12px",
                        }}
                      >
                        {child.topPresets.length > 0
                          ? child.topPresets.slice(0, 3).join(", ")
                          : "—"}
                      </td>
                    </tr>
                  </tbody>
                </table>

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

          <Text
            style={{
              color: "#9ca3af",
              fontSize: "12px",
              margin: 0,
            }}
          >
            This weekly summary is sent automatically by KidsChat. You are
            receiving this because you are an admin with weekly digest
            notifications enabled.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default WeeklyDigestEmail;
