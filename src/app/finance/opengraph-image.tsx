import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import { join } from "path";

export const runtime = "nodejs";
export const alt = "Commons Hub Brussels - Transparent Finances";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  // Data will be fetched from API in the future - for now hardcoded
  const balance = "€84,494";
  const income = "+€49,824";
  const expenses = "-€71,727";

  const date = new Date("2025-12-04");
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const asOfDate = `As of ${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;

  // Read background image
  const backgroundPath = join(
    process.cwd(),
    "public",
    "images",
    "ogimage-background.jpg"
  );
  const backgroundBuffer = await readFile(backgroundPath);
  const backgroundBase64 = backgroundBuffer.toString("base64");

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {/* Background Image - full opacity */}
        <img
          src={`data:image/jpeg;base64,${backgroundBase64}`}
          alt=""
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 1.0,
          }}
        />

        {/* Dark overlay for readability */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.25)",
          }}
        />

        {/* Content wrapper */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 5,
          }}
        >
          {/* Logo */}
          <svg
            width="80"
            height="80"
            viewBox="0 0 500 500"
            style={{
              marginBottom: "20px",
            }}
          >
            <g clipPath="url(#clip0_48_36)">
              <rect width="500" height="500" fill="#FF4C02" />
              <path
                d="M213.528 91L126.722 141.505L201.691 225.154L92 201.48V302.49L201.691 280.394L126.722 359.308L213.528 409.813L250.223 303.632L286.918 409.813L373.723 359.308L298.755 280.394L408.446 302.49V201.48L298.755 225.154L373.723 141.505L286.918 91L250.223 190.155L213.528 91Z"
                fill="#FBF4F2"
              />
            </g>
            <defs>
              <clipPath id="clip0_48_36">
                <rect width="500" height="500" rx="250" fill="white" />
              </clipPath>
            </defs>
          </svg>

          {/* Title */}
          <div
            style={{
              fontSize: "48px",
              fontWeight: "bold",
              color: "#ffffff",
              marginBottom: "12px",
            }}
          >
            Commons Hub Brussels
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: "28px",
              color: "#d0d0d0",
              marginBottom: "40px",
            }}
          >
            Transparent Finances
          </div>

          {/* Stats */}
          <div
            style={{
              display: "flex",
              width: "100%",
              justifyContent: "center",
            }}
          >
            {/* Balance */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                borderRadius: "20px",
                padding: "30px",
                backgroundColor: "rgba(255, 76, 2, 0.85)",
                marginRight: "15px",
                minWidth: "260px",
              }}
            >
              <div
                style={{
                  fontSize: "18px",
                  color: "#ffffff",
                  marginBottom: "10px",
                }}
              >
                Current Balance
              </div>
              <div
                style={{
                  fontSize: "44px",
                  fontWeight: 900,
                  color: "#000000",
                }}
              >
                {balance}
              </div>
            </div>

            {/* Income */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                borderRadius: "20px",
                padding: "30px",
                backgroundColor: "rgba(255, 76, 2, 0.85)",
                marginRight: "15px",
                minWidth: "260px",
              }}
            >
              <div
                style={{
                  fontSize: "18px",
                  color: "#ffffff",
                  marginBottom: "10px",
                }}
              >
                Nov 2024 Income
              </div>
              <div
                style={{
                  fontSize: "44px",
                  fontWeight: "bold",
                  color: "#000000",
                }}
              >
                {income}
              </div>
            </div>

            {/* Expenses */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                borderRadius: "20px",
                padding: "30px",
                backgroundColor: "rgba(255, 76, 2, 0.85)",
                minWidth: "260px",
              }}
            >
              <div
                style={{
                  fontSize: "18px",
                  color: "#ffffff",
                  marginBottom: "10px",
                }}
              >
                Nov 2024 Expenses
              </div>
              <div
                style={{
                  fontSize: "44px",
                  fontWeight: "bold",
                  color: "#000000",
                }}
              >
                {expenses}
              </div>
            </div>
          </div>

          {/* Timestamp */}
          <div
            style={{
              marginTop: "30px",
              fontSize: "16px",
              color: "#999999",
            }}
          >
            {asOfDate}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
