import React from "react";

const pdfjs = {
  GlobalWorkerOptions: { workerSrc: "" },
  version: "0.0.0",
};

function Document({ children, ...props }) {
  return React.createElement("div", { "data-testid": "pdf-document", ...props }, children);
}

function Page({ pageNumber, ...props }) {
  return React.createElement("div", { "data-testid": "pdf-page", "data-page": pageNumber, ...props });
}

export { Document, Page, pdfjs };
