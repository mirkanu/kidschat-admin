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

export interface DailyChildStat {
  name: string;
  totalMessages: number;
  imageRequests: number;
  topPresets: string[];
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
                        Image Requests
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
                        Presets Used
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
                        {child.imageRequests}
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
                          : "\u2014"}
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
