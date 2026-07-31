"use client";
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash, Plus, QrCodeIcon, VideoIcon, FileIcon, ImageIcon, PencilIcon, ChevronUp, ChevronDown } from "lucide-react";
import { Question } from "./form-creator";
import { Label } from "../ui/label";
import axiosInstance from "@/utils/axiosInstance";

interface TablePreviewProps {
  question: Question;
  items: any[];
  onItemsChange: (items: any[]) => void;
}

export default function TablePreview({ question, items, onItemsChange }: TablePreviewProps) {
  const [locations, setLocations] = useState<any[]>([]);
    const [openItems, setOpenItems] = useState<number[]>([]); // track which items are expanded

  // const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    // fetchFolders();
    // fetchQuestionTypes();
    fetchLocations();
    // fetchDivisions();
  }, []);
  const fetchLocations = async () => {
    try {
      const response = await axiosInstance.get("/location/");
      setLocations(response.data); // adjust based on your API response structure
    } catch (error) {
      console.error("Error fetching locations:", error);
    }
  };
  function renderField(subQ: Question, value: any, onChange: (v: any) => void) {
    switch (subQ.type) {
      case "short_answer":
      case "text":
        return (
          <Input
            value={value}
            type={subQ.valueType}
            onChange={(e) => onChange(e.target.value)}
            placeholder={subQ.title}
          />
        );
      case "long_answer":
        return (
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={subQ.title}
          />
        );
      case "date":
        return (
          <Input
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={subQ.title}
          />
        );

      case "multiple_choice":
        return (
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700">
              {/* {question.title} */}
            </div>

            <div className="space-y-2">
              {(subQ.options ?? []).map((opt, idx) => (
                <label key={idx} className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name={`question-${subQ.id}`}
                    value={opt}
                    defaultChecked={subQ.previewAnswer === opt}
                    readOnly
                  />
                  <span className="text-sm text-gray-800">{opt}</span>
                </label>
              ))}
            </div>
          </div>
        );


      case "dropdown":
        return (
          <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full">
            {(subQ.options || []).map((opt: string) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );

      case "checkboxes":
        return (
          <div className="flex flex-col">
            {(subQ.options || []).map((opt: string) => (
              <label key={opt} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  defaultChecked={Array.isArray(value) ? value.includes(opt) : false}
                  readOnly
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        );


      case "signature":
        return (
          <div className="space-y-3">
            {/* Signature Pad UI */}
            <div className="border-2 border-dotted border-gray-400 rounded-md h-16 flex items-center justify-center cursor-pointer hover:bg-blue-100 transition">
              <div className="flex items-center gap-2 text-primary">
                <PencilIcon className="h-4 w-4" />
                <span className="text-sm font-medium">Tap to sign</span>
              </div>
            </div>
            <div>
              <Label htmlFor={`question-${subQ.id}-fullname`} className="text-sm">
                Full Name
              </Label>
              <Input
                id={`question-${subQ.id}-fullname`}
                placeholder="Enter full name"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Name field is optional if this is submitter's signature.
              </p>
            </div>
          </div>
        );

      case "upload_image":
        return (
          <div className="border-2 border-black border-dotted rounded-md p-6 flex flex-col items-center justify-center">
            <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground text-center">
              {subQ.cameraOnly
                ? "Take a photo"
                : "Tap to upload a picture"}
              <br />
              {subQ.maxFiles && (
                <span className="text-xs text-muted-foreground">
                  Up to {subQ.maxFiles} image{subQ.maxFiles > 1 ? "s" : ""}
                </span>
              )}
            </p>
          </div>
        );

      case "upload_file":
        return (
          <div className="border border-black border-dotted rounded-md p-6 flex flex-col items-center justify-center">
            <FileIcon className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground text-center">
              Tap to upload a file
              <br />
              {subQ.maxFiles && (
                <span className="text-xs text-muted-foreground">
                  Up to {subQ.maxFiles} file{subQ.maxFiles > 1 ? "s" : ""}
                </span>
              )}
            </p>
          </div>
        );

      case "location":
        return (
          <div>
            <Label htmlFor={`question-${subQ.id}-select`}></Label>
            <select
              className="mt-1 block w-full border rounded px-3 py-2 text-sm"
              value={subQ.previewAnswer}
            // onChange={(e) => handleQuestionUpdate(stage.id, question.id, "previewAnswer", e.target.value)}
            >
              <option value="">- Select Location -</option>
              {
                locations.map(l => <option key={l.id} value={l.id}>{l?.description || "NA"}</option>)
              }
            </select>
          </div>
        );

      case "upload_video":
        return (
          <div className="border border-black border-dotted  rounded-md p-6 flex flex-col items-center justify-center">
            <VideoIcon className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground text-center">
              {subQ.requiresLive
                ? "Record a video"
                : "Tap to upload a video"}
              <br />
            </p>
          </div>
        )
      case "qr_code":
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-3 border rounded-md px-4 py-2">
              <div
                className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary
                   hover:bg-primary hover:text-white transition-colors duration-200 cursor-pointer"
              >
                <QrCodeIcon className="h-5 w-5" />
              </div>
              <div className="h-6 w-px bg-gray-300" />
              <input
                id={`question-${subQ.id}-hint`}
                type="text"
                value={subQ.hint || ""}
                readOnly
                className="flex-1 bg-transparent border-none outline-none text-sm pl-1"
              />
            </div>
          </div>
        );
      case "formula":
        return (
          <div className="space-y-2">
            <Input disabled value="=[Field1] + [Field2]" />
            <p className="text-xs text-muted-foreground">
              Result will be calculated based on other field values
            </p>
          </div>
        );

      default:
        return <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={subQ.title} />;
    }
  }

  // function handleAddItem() {
  //   onItemsChange([
  //     ...items,
  //     (question.tableSubQuestions || []).reduce((row, sq) => {
  //       row[sq.id] = sq.type === "checkboxes" ? [] : "";
  //       return row;
  //     }, {} as Record<string, any>),
  //   ]);
  // }
const subQuestions = question.tableSubQuestions?.length
  ? question.tableSubQuestions
  : question.subQuestions || [];

  function handleAddItem() {
  onItemsChange([
    ...items,
    subQuestions.reduce((row, sq) => {
      row[sq.id] = sq.type === "checkboxes" ? [] : "";
      return row;
    }, {} as Record<string, any>),
  ]);
}

  function handleRemoveItem(idx: number) {
    const newItems = items.filter((_, i) => i !== idx);
    onItemsChange(newItems);
  }

  function handleFieldChange(idx: number, subQId: string, value: any) {
    const itemsCopy = [...items];
    itemsCopy[idx] = { ...itemsCopy[idx], [subQId]: value };
    onItemsChange(itemsCopy);
  }

  const toggleItem = (idx: number) => {
    setOpenItems((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  return (
    <div>
      <div className="mb-2">
        <Button size="sm" onClick={handleAddItem}>
          <Plus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
      </div>

      <div className="space-y-4">
        {items.map((item, idx) => {
          const isOpen = openItems.includes(idx);
          return (
            <Card key={idx}>
              <CardHeader className="flex flex-row items-center justify-between pb-0 pt-2 mb-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    // size="small"
                    onClick={() => toggleItem(idx)}
                    className="bg-gray-200 rounded-full size-6"
                  >
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                  <CardTitle>Item {idx + 1}</CardTitle>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveItem(idx)}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                  
                </div>
              </CardHeader>

              {isOpen && (
                <CardContent>
                  <div className="space-y-4 border-t border-t-muted-foreground/10 pt-4">
                    {(subQuestions || []).map((subQ) => (
                      <div key={subQ.id} className="border-2 border-gray-300 rounded-md p-2">
                        <label className="block font-medium mb-1">
                          {subQ.title}
                          {subQ.required && (
                            <span className="text-destructive ml-1">*</span>
                          )}
                        </label>
                        {renderField(
                          subQ,
                          item[subQ.id],
                          (val) => handleFieldChange(idx, subQ.id, val)
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {items.length === 0 && (
        <div className="text-sm text-muted-foreground mt-2">
          No items added yet.
        </div>
      )}
    </div>
  );
}
