import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type JsPdfWithPageCount = jsPDF & {
  getNumberOfPages: () => number;
};

// Helper function to check if URL is an image
const isImageUrl = (url: string): boolean => {
  // Must NOT be a video file
  if (/\.(mp4|webm|ogg|avi|mov|wmv|flv|mkv)$/i.test(url) ||
    url.includes('video/upload')) {
    return false;
  }

  // Must be an image file
  return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url) ||
    (url.includes('cloudinary') && url.includes('image/upload'));
};

// Helper function to check if URL is a video
const isVideoUrl = (url: string): boolean => {
  return /\.(mp4|webm|ogg|avi|mov|wmv|flv|mkv)$/i.test(url) ||
    url.includes('video/upload');
};

// Helper function to download and embed image in PDF with fast timeout
// Cleaner version: one unified timeout + Cloudinary optimization
const addImageToPDF = async (
  pdf: jsPDF,
  imageUrl: string,
  x: number,
  y: number,
  maxWidth: number = 50
): Promise<number> => {
  try {
    console.log('Loading image:', imageUrl);

    // 👉 Auto-optimize Cloudinary images if possible
    if (imageUrl.includes("res.cloudinary.com") && imageUrl.includes("/upload/")) {
      // Insert Cloudinary transformation for faster loading
      imageUrl = imageUrl.replace(
        "/upload/",
        "/upload/w_600,f_auto,q_auto/"
      );
    }

    // Timeout controller (15s)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(imageUrl, {
      signal: controller.signal,
      mode: "cors",
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Image fetch failed: ${response.status} ${response.statusText}`);
    }

    const blob = await response.blob();

    // Reject super-large images (optional safeguard, 5MB max)
    if (blob.size > 5 * 1024 * 1024) {
      throw new Error("Image too large");
    }

    // Convert blob → base64
    const base64String = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read image"));
      reader.readAsDataURL(blob);
    });

    // Preload image to calculate dimensions
    const img = new Image();
    const loadPromise = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load image"));
    });
    img.src = base64String;
    await loadPromise;

    // Maintain aspect ratio
    const aspectRatio = img.width / img.height;
    let width = Math.min(maxWidth, img.width);
    let height = width / aspectRatio;

    if (height > 40) {
      height = 40;
      width = height * aspectRatio;
    }

    // Embed image in PDF
    pdf.addImage(base64String, "JPEG", x, y, width, height);
    console.log("✅ Image embedded successfully:", imageUrl);

    return height + 5; // extra padding
  } catch (error) {
    console.error("⚠️ Error embedding image:", imageUrl, error);
    pdf.text(`(Image failed: ${imageUrl})`, x, y);
    return 8; // fallback height
  }
};


const embedImages = async (
  pdf: jsPDF,
  answer: string,
  x: number,
  y: number
): Promise<number> => {
  // Split multiple image URLs separated by '|'
  const urls = answer.split("|").map(u => u.trim());
  let currentY = y;

  for (const url of urls) {
    // Skip empty strings
    if (!url) continue;

    const heightUsed = await addImageToPDF(pdf, url, x, currentY);
    currentY += heightUsed + 5; // spacing between images
  }

  return currentY - y; // total height used
};


interface FormResponse {
  id: string | number;
  submission_initiated_on?: string;
  submission_initiated_by?: string;
  initiator_designation?: string;
  initiator_department?: string;
  initiator_location?: string;
  current_owner?: string;
  is_completed?: boolean;
  stages?: Array<{
    id: number;
    name: string;
    order: number;
    is_completed?: boolean;
    questions: Array<{
      id: number;
      question: string;
      question_type: string;
      order: number;
      answers?: {
        answer: string;
        question_type: string;
        question?: number;
        Form?: number;
        stage?: number;
        [key: string]: any;
      };
      logics?: Array<{
        logic_questions?: Array<{
          id: number;
          question: string;
          question_type: string;
          order: number;
          answers?: {
            answer: string;
            question_type: string;
            [key: string]: any;
          };
        }>;
      }>;
    }>;
  }>;
  stage_details?: Array<{
    stage_name: string;
    order: number;
    is_completed: boolean;
  }>;
}

interface FormData {
  title?: string;
  form_type?: string;
  created_by?: string;
  created_at?: string;
}

export const generateFormResponsesPDF = async (
  responses: FormResponse[],
  formData?: FormData,
  formId?: string | number
): Promise<void> => {
  try {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.width;
    const pageHeight = pdf.internal.pageSize.height;
    const margin = 20;
    let yPosition = margin;

    // Helper function to add new page if needed
    const checkAndAddNewPage = (requiredHeight: number) => {
      if (yPosition + requiredHeight > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
        return true;
      }
      return false;
    };

    // Header
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    const title = formData?.title || `Form Responses - ${formId || 'N/A'}`;
    pdf.text(title, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Form info
    if (formData) {
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Form Type: ${formData.form_type || 'N/A'}`, margin, yPosition);
      yPosition += 8;
      pdf.text(`Created by: ${formData.created_by || 'N/A'}`, margin, yPosition);
      yPosition += 8;
      if (formData.created_at) {
        pdf.text(`Created on: ${new Date(formData.created_at).toLocaleDateString()}`, margin, yPosition);
        yPosition += 8;
      }
    }

    yPosition += 10;

    // Summary
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Total Responses: ${responses.length}`, margin, yPosition);
    yPosition += 15;

    // Process each response
    for (let index = 0; index < responses.length; index++) {
      const response = responses[index];
      checkAndAddNewPage(60);

      // Response header
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Response #${index + 1} - ID: ${response.id}`, margin, yPosition);
      yPosition += 12;

      // Response details
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');

      const details = [
        `Submission Date: ${response.submission_initiated_on ? new Date(response.submission_initiated_on).toLocaleString() : 'N/A'}`,
        `Initiated By: ${response.submission_initiated_by || 'N/A'}`,
        `Designation: ${response.initiator_designation || 'N/A'}`,
        `Department: ${response.initiator_department || 'N/A'}`,
        `Location: ${response.initiator_location || 'N/A'}`,
        `Current Owner: ${response.current_owner || 'N/A'}`,
        `Status: ${response.is_completed ? 'Completed' : 'Pending'}`
      ];

      details.forEach(detail => {
        checkAndAddNewPage(8);
        pdf.text(detail, margin + 5, yPosition);
        yPosition += 8;
      });

      // Detailed form structure with stages and questions
      if (response.stages && response.stages.length > 0) {
        yPosition += 5;
        pdf.setFont('helvetica', 'bold');
        pdf.text('Form Details:', margin + 5, yPosition);
        yPosition += 10;

        pdf.setFont('helvetica', 'normal');
        for (let stageIndex = 0; stageIndex < response.stages.length; stageIndex++) {
          const stage = response.stages[stageIndex];
          checkAndAddNewPage(15);

          // Stage header
          const stageStatus = stage.is_completed ? '✓' : '○';
          pdf.setFont('helvetica', 'bold');
          pdf.text(`${stageStatus} ${stage.name} (Stage ${stage.order})`, margin + 10, yPosition);
          yPosition += 10;

          // Questions and answers
          if (stage.questions && stage.questions.length > 0) {
            pdf.setFont('helvetica', 'normal');

            for (let questionIndex = 0; questionIndex < stage.questions.length; questionIndex++) {
              const question = stage.questions[questionIndex];

              // Check if we need a new page (accounting for potential image height)
              const needsNewPage = checkAndAddNewPage(60);

              // Question
              pdf.setFont('helvetica', 'bold');
              const questionText = `Q${questionIndex + 1}: ${question.question}`;
              pdf.text(questionText, margin + 15, yPosition);
              yPosition += 8;

              // Answer
              if (question.answers && question.answers.answer) {
                pdf.setFont('helvetica', 'normal');

                // Check if answer is an image URL
                if (isImageUrl(question.answers.answer)) {
                  try {
                    console.log('Processing image answer(s):', question.answers.answer);
                    const totalHeight = await embedImages(pdf, question.answers.answer, margin + 20, yPosition);
                    yPosition += totalHeight;
                    console.log('Image(s) processed successfully');
                  } catch (error) {
                    console.error('Failed to embed image(s), using fallback:', error);
                    pdf.text(`Answer: (Image) ${question.answers.answer}`, margin + 20, yPosition);
                    yPosition += 8;
                  }
                } else if (isVideoUrl(question.answers.answer)) {
                  // Handle video files
                  console.log('Processing video answer:', question.answers.answer);
                  pdf.text(`Answer: (Video) ${question.answers.answer}`, margin + 20, yPosition);
                  yPosition += 8;
                } else {
                  // Regular text answer
                  const answerText = `Answer: ${question.answers.answer}`;
                  pdf.text(answerText, margin + 20, yPosition);
                  yPosition += 8;
                }
              } else {
                pdf.setFont('helvetica', 'italic');
                pdf.text('No answer provided', margin + 20, yPosition);
                yPosition += 8;
              }

              yPosition += 5;
            }
          }

          yPosition += 5;
        }
      }
      // Fallback to stage_details if detailed stages not available
      else if (response.stage_details && response.stage_details.length > 0) {
        yPosition += 5;
        pdf.setFont('helvetica', 'bold');
        pdf.text('Stage Progress:', margin + 5, yPosition);
        yPosition += 8;

        pdf.setFont('helvetica', 'normal');
        response.stage_details.forEach(stage => {
          checkAndAddNewPage(8);
          const status = stage.is_completed ? '✓' : '○';
          pdf.text(`${status} ${stage.stage_name} (Order: ${stage.order})`, margin + 10, yPosition);
          yPosition += 8;
        });
      }

      yPosition += 10;

      // Add separator line
      if (index < responses.length - 1) {
        checkAndAddNewPage(10);
        pdf.setLineWidth(0.5);
        pdf.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 10;
      }
    }

    // Footer
    const totalPages = (pdf as JsPdfWithPageCount).getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.text(
        `Generated on ${new Date().toLocaleString()} | Page ${i} of ${totalPages}`,
        margin,
        pageHeight - 10
      );
    }

    // Save the PDF
    const fileName = `form_${formId}_responses_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);

  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF. Please try again.');
  }
};

export const generateSingleResponsePDF = async (
  response: FormResponse,
  formData?: FormData,
  formId?: string | number
): Promise<void> => {
  await generateFormResponsesPDF([response], formData, formId);
};

export default generateFormResponsesPDF;
