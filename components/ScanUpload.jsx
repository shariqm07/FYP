"use client";

import { useState, useEffect, useRef } from "react";
import Webcam from "react-webcam";
import { jsPDF } from "jspdf";
import Tesseract from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist/webpack"; // Use this import for proper webpack handling
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const ScanUpload = ({ action, onClose }) => {
  const [type, setType] = useState("all");
  const [file, setFile] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [diaryNo, setDiaryNo] = useState("");
  const [from, setFrom] = useState("");
  const [disposal, setDisposal] = useState("");
  const [status, setStatus] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const webcamRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const response = await fetch(`/api/department?type=${type}`, {
          method: "GET",
        });
        const data = await response.json();
        setDepartments(data);
      } catch (error) {
        console.error("Failed to fetch departments", error);
      }
    };

    fetchDepartments();
  }, [type]);

  const handleDepartmentChange = (e) => {
    const departmentId = e.target.value;
    setSelectedDepartment(departmentId);
    const department = departments.find((dept) => dept._id === departmentId);
    setCategories(department?.categories || []);
    setSelectedCategory("");
  };

  const handleCapture = async() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      setCapturedImage(imageSrc);
      setIsScanning(false);
      await performOCR(imageSrc);
    } else {
      console.error("Webcam reference is null");
    }
  };

  const handleScanStart = () => {
    setIsScanning(true);
    setCapturedImage(null);
  };

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile || selectedFile.type !== "application/pdf") {
      alert("Please upload a valid PDF file.");
      setSubject("");
      return;
    }
    setFile(selectedFile);
    setIsProcessing(true);

    try {
      // Read the PDF as a file buffer
      const fileBuffer = await selectedFile.arrayBuffer();

      // Step 1: Attempt text extraction using pdfjs-dist
      const text = await extractTextFromPdf(fileBuffer);

      // Step 2: Try to find the subject in the extracted text
      let subject = findSubjectInText(text);
      // if (!subject) {
      //   // If no subject found, fallback to OCR using Tesseract.js
      //   console.log("No subject found in text. Attempting OCR...");
      //   subject = await performOCR(fileBuffer);
      // }

      // Step 3: Set the extracted subject
      if (subject) {
        setSubject(subject);
      } else {
        alert("No subject found in the uploaded file.");
        setSubject(""); // Clear subject if not found
      }
    } catch (error) {
      console.error("Error processing file:", error);
      alert("Failed to extract text or subject from the file.");
    } finally {
      setIsProcessing(false); // End processing
    }
  };

  async function extractTextFromPdf(fileBuffer) {
    const loadingTask = pdfjsLib.getDocument(fileBuffer);
    const pdf = await loadingTask.promise;

    let textContent = "";

    // Iterate through each page to extract text
    for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex++) {
      const page = await pdf.getPage(pageIndex);

      // Extract text content from the page using pdfjs-dist
      const text = await page.getTextContent();

      // Combine the text items into a single string
      textContent += text.items.map((item) => item.str).join(" ");
    }

    return textContent;
  }

  // Utility: Perform OCR using Tesseract.js
  const performOCR = async (imageData) => {
    // Convert PDF pages to PNG images
    setIsProcessing(true);

  try {
    // Perform OCR on the scanned image
    const result = await Tesseract.recognize(imageData, "eng", {
      logger: (m) => console.log(m), // Log OCR progress
    });

    const extractedText = result.data.text;

    // Try to find the subject in the extracted text
    const subject = findSubjectInText(extractedText);
    if (subject) {
      setSubject(subject);
    } else {
      alert("No subject found in the scanned image.");
      setSubject("");
    }
  } catch (error) {
    console.error("Error performing OCR on scanned image:", error);
    alert("Failed to extract text from the scanned image.");
  } finally {
    setIsProcessing(false);
  }
};
  // };

  // Utility: Search for a "subject" in the extracted text
  const findSubjectInText = (text) => {
    // Refined regex to look for 'Subject' or 'Subj' at the beginning of a line and capture the following text
    const subjectMatch = text.match(
      /(?:subject|subj)\s*[:\-]?\s*(.*?)(?:\s{2,}|$|\n|\r|\!|\?|\.|\:)/i
    );
    return subjectMatch ? subjectMatch[1].trim() : null;
  };

  const convertImageToPdf = async (imageData) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const pdf = new jsPDF({
          orientation: img.width > img.height ? "l" : "p",
          unit: "px",
          format: [img.width, img.height],
        });
        pdf.addImage(imageData, "JPEG", 0, 0, img.width, img.height);
        resolve(pdf.output("blob"));
      };
      img.src = imageData;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    if (
      (!file && !capturedImage) ||
      !selectedDepartment ||
      !subject ||
      !diaryNo ||
      !from ||
      !disposal ||
      !status
    ) {
      alert(
        "Please fill out all fields and either upload a file or capture an image."
      );
      setIsLoading(false);
      return;
    }

    const formData = new FormData();

    if (file) {
      formData.append("file", file);
    } else if (capturedImage) {
      const pdfBlob = await convertImageToPdf(capturedImage);
      formData.append("file", pdfBlob, "captured_image.pdf");
    }
    formData.append("type", type);
    formData.append("department", selectedDepartment);
    formData.append("category", selectedCategory);
    formData.append("subject", subject);
    formData.append("date", date);
    formData.append("diaryNo", diaryNo);
    formData.append("from", from);
    formData.append("disposal", disposal);
    formData.append("status", status);

    try {
      const response = await fetch("/api/scanupload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        );
      }

      const data = await response.json();
      alert(data.message);
      onClose();
    } catch (error) {
      console.error("Upload error:", error);
      alert(`An error occurred during upload: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold mb-6">{action} Form</h2>
      <form onSubmit={handleSubmit} className="suform">
        <div className="form-group">
          <label>Type:</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">All</option>
            <option value="uni">University</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="form-group">
          <label>Department:</label>
          <select
            value={selectedDepartment}
            onChange={handleDepartmentChange}
            required>
            <option value="">Select Department</option>
            {departments.map((dept) => (
              <option key={dept._id} value={dept._id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Category:</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            disabled={!categories.length}>
            <option value="">Select Category</option>
            {categories.map((cat, index) => (
              <option key={index} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Subject:</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Date:</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Diary No:</label>
          <input
            type="text"
            value={diaryNo}
            onChange={(e) => setDiaryNo(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>From:</label>
          <input
            type="text"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Disposal:</label>
          <input
            type="text"
            value={disposal}
            onChange={(e) => setDisposal(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Status:</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            required>
            <option value="">Select Status</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        {action === "Scan" ? (
          <div>
            {!isScanning && !capturedImage && (
              <button type="button" onClick={handleScanStart}>
                Start Scanning
              </button>
            )}
            {isScanning && (
              <div>
                <Webcam
                  audio={false}
                  screenshotFormat="image/jpeg"
                  width="100%"
                  ref={webcamRef}
                 
                />
                <button type="button" onClick={handleCapture}>
                  Capture
                </button>
              </div>
            )}
            {capturedImage && (
              <div>
                <img
                  src={capturedImage}
                  alt="Captured"
                  style={{ maxWidth: "100%", marginTop: "10px" }}
                />
                <button type="button" onClick={handleScanStart}>
                  Scan Again
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="form-group">
            <label>File:</label>
            <input
              type="file"
              onChange={handleFileChange}
              accept="application/pdf"
              required
            />
            {isProcessing && <p>Extracting text from file... Please wait.</p>}
          </div>
        )}
       <div className="flex gap-10 justify-center"> 
        <button type="submit" disabled={isLoading || (!file && !capturedImage)}>
          {isLoading ? "Saving..." : "Save"}
        </button>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
        </div>
      </form>
    </div>
  );
};

export default ScanUpload;
