import React, { useEffect, useState } from 'react'
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  ClipboardList,
  MapPin,
  Plus,
  Trash,
  Copy,
  MoveUp,
  MoveDown,
  Save,
  Eye,
  X,
  ArrowLeft,
  ArrowRight,
  Settings,
  TableIcon,
  FileText,
  Calendar,
  Clock,
  ImageIcon,
  Calculator,
  Type,
  CheckSquare,
  Star,
  Layers,
  User,
  VideoIcon,
  FileIcon,
  PencilIcon,
  QrCode,
  QrCodeIcon,
  Circle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import axiosInstance from '@/utils/axiosInstance'
import { Question } from './form-creator'



export default function ConditionalQuestion({ subQ }: { subQ: Question }) {

  const [localSubQ, setLocalSubQ] = useState<Question>(subQ);

  const [tableRows, setTableRows] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  console.log(subQ.type)
  useEffect(() => {
    // fetchFolders();
    // fetchQuestionTypes();
    fetchLocations();
    // fetchDivisions();
    fetchUsers();
  }, []);

  const fetchLocations = async () => {
    try {
      const response = await axiosInstance.get("/location/");
      console.log("Fetched Locations:", response.data);
      setLocations(response.data); // adjust based on your API response structure
    } catch (error) {
      console.error("Error fetching locations:", error);
    }
  };
  const fetchUsers = async () => {
    try {
      const response = await axiosInstance.get("/users/list");
      setUsers(response.data);
    } catch (error) {
      console.error("Error while fetching users:", error);
    }

  };
  // Helper: render the appropriate input for a column sub-question
  function renderTableField(subCol: Question, value: any, onChange: (v: any) => void) {
    switch (subCol.type) {
      case "short_answer":
      case "text":
        return (
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1"
            required={subCol.required}
            placeholder={subCol.description}
            type={subCol.valueType === "number" ? "number" : "text"}
          />
        );
      case "long_answer":
        return (
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      case "date":
        return (
          <Input
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      case "time":
        return (
          <Input
            type="time"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      case "multiple_choice":
        return (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="border  rounded px-2 py-1 w-full"
          >
            <option value="">Select</option>
            {subCol.options?.map((opt, i) => (
              <option key={i} value={opt}>{opt}</option>
            ))}
          </select>
        );
      case "checkbox":
        return (
          <div className="flex flex-col">
            {subCol.options?.map((opt, i) => (
              <label key={i} className="flex items-center">
                <input
                  type="checkbox"
                  checked={Array.isArray(value) && value.includes(opt)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onChange([...(value || []), opt]);
                    } else {
                      onChange((value || []).filter((v: any) => v !== opt));
                    }
                  }}
                />
                <span className="ml-1">{opt}</span>
              </label>
            ))}
          </div>
        );
      // Add more field types as needed
      default:
        return <Input value={value} onChange={(e) => onChange(e.target.value)} />;
    }
  }

  // Table type
  if (subQ.type === "table") {

    return (
      <div className="ml-4">
        <Label>{subQ.title}</Label>
        <div className="mb-2 mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setTableRows((prev) => [
                ...prev,
                (subQ.subQuestions || []).reduce((row, sq) => {
                  row[sq.id] = sq.type === "checkbox" ? [] : ""; // default: empty string, checkboxes: empty array
                  return row;
                }, {} as Record<string, any>)
              ]);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
        </div>
        <div className="border rounded-md overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr>
                {subQ.subQuestions?.map((colQ) => (
                  <th key={colQ.id} className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {colQ.title}
                  </th>
                ))}
                <th className="px-4 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tableRows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {subQ.subQuestions?.map((colQ) => (
                    <td key={colQ.id} className="px-4 py-2">
                      {renderTableField(
                        colQ,
                        row[colQ.id],
                        (val) => {
                          setTableRows((prevRows) => {
                            const newRows = [...prevRows];
                            newRows[rowIndex] = { ...newRows[rowIndex], [colQ.id]: val };
                            return newRows;
                          });
                        }
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setTableRows((prevRows) => {
                          const newRows = [...prevRows];
                          newRows.splice(rowIndex, 1);
                          return newRows;
                        });
                      }}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tableRows.length === 0 && (
          <div className="text-sm text-muted-foreground mt-2">No items added yet.</div>
        )}
      </div>
    );
  }

  if (subQ.type === "audit") {
    // Defensive fallback for option list
    const auditOptions = subQ.auditOptions && subQ.auditOptions.length
      ? subQ.auditOptions
      : [{ value: "Pass", score: 1 }, { value: "Fail", score: 0 }];

    // Find max score (default to 1 if not found)
    const maxScore = auditOptions.reduce(
      (max, opt) => Math.max(max, Number(opt.score) || 0),
      0
    );

    // State to track selection
    const [selected, setSelected] = useState<number | null>(null); // index of selected option

    // Calculate current score & percentage
    const currentScore = selected !== null ? Number(auditOptions[selected]?.score) : 0;
    const percentage = maxScore > 0 ? (currentScore / maxScore) * 100 : 0;

    return (
      <div className="ml-1 mt-4 space-y-3">
        {/* 1. Score Percentage */}
        <div>
          <Label className="text-sm font-semibold">Score Percentage:</Label>{" "}
          <span className="text-lg">{percentage.toFixed(1)}%</span>
        </div>
        {/* 2. Score */}
        <div>
          <Label className="text-sm font-semibold">Score:</Label>{" "}
          <span className="text-lg">{currentScore} / {maxScore}</span>
        </div>
        {/* 3. Options as radio */}
        <div className="space-y-2">
          {auditOptions.map((opt:any, idx:number) => (
            <label key={idx} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name={`audit-${subQ.id}`}
                value={opt.value}
                checked={selected === idx}
                onChange={() => setSelected(idx)}
                className="accent-blue-500"
              />
              <span className="text-base">{opt.value} ({opt.score})</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div key={subQ.id} className="ml-1 mt-4 space-y-2">
      <Label>
        <h3 className="text-xl font-semibold">{localSubQ.title}</h3>
        {subQ.required && <span className="text-destructive ml-1">*</span>}
      </Label>

      {subQ.type === "short_answer" && <div className="space-y-2">
        <div className="flex">
          <div style={{ width: "100%" }} className="mr-2">
            <Input className="text-gray-400"
              value={localSubQ.description || ""}
              onChange={(e) =>
                setLocalSubQ((prev) => ({ ...prev, description: e.target.value }))
              }
              type={subQ.valueType === "number" ? "number" : "text"}
            />
          </div>
        </div>
      </div>
      }

      {subQ.type === "title_and_description" && <div className="space-y-2">
        <div className="flex">
          <div className="space-y-3">
            {/* <h3 className="text-xl font-semibold">{localSubQ.title}</h3> */}
            {localSubQ.description &&
              <Input className="text-muted-foreground"
                value={localSubQ.description || ""}
              />
            }
          </div>
        </div>
      </div>
      }



      {subQ.type === "long_answer" &&
        <div className="space-y-2">
          <Textarea
            className="text-gray-400"
            placeholder=""
            value={localSubQ.description || ""}
            onChange={(e) =>
              setLocalSubQ((prev) => ({ ...prev, description: e.target.value }))
            } />
        </div>
      }



      {subQ.type === "multiple_choice" && (
        <div className="space-y-2">
          {/* Display the question title */}
          <div className="text-sm font-medium text-gray-700">
            {/* {question.title} */}
          </div>

          <div className="space-y-2">
            {(subQ.options ?? []).map((opt, idx) => (
              <label key={idx} className="flex items-center space-x-2">
                <input
                  type="radio"
                  name={`question-${subQ.id}`} // unique group name
                  value={opt}
                  checked={subQ.previewAnswer === opt}
                // onChange={(e) =>
                //   handleQuestionUpdate(stage.id, question.id, "previewAnswer", e.target.value)
                // }
                />
                <span className="text-sm text-gray-800">{opt}</span>
              </label>
            ))}
          </div>
        </div>
      )}


      {subQ.type === "checkboxes" && subQ.options && (
        <div className="space-y-4">
          {subQ.options.map((option, index) => (
            <div key={index} className="flex items-center space-x-2">
              <Checkbox id={`checkbox-${index}`} />
              <Label htmlFor={`checkbox-${index}`}>{option}</Label>
            </div>
          ))}
        </div>
      )}

      {subQ.type === "user" && (
        <div>
          <Label htmlFor={`question-${subQ.id}-select`}></Label>
          <select
            // id={`question-${user.id}-select`}
            // value={question.title} // or question.value, depending on your structure
            // onChange={(e) =>
            // handleQuestionUpdate(activeStage, user.id, "title", e.target.value)
            // }
            className="mt-1 block w-full border rounded px-3 py-2 text-sm"
          >
            <option value="">Select User</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {subQ.type === "division" && (
        <div >
          <Label htmlFor={`subQ-${subQ.id}-select`}></Label>
          <select
            className="mt-1 block w-full border rounded px-3 py-2 text-sm"
          >
            <option value="">- Select Division -</option>
            <option value="Division1">Division 1</option>
            <option value="Division2">Division 2</option>
            <option value="Division3">Division 3</option>
          </select>
        </div>
      )}

      {subQ.type === "sub_division" && (
        <div>
          <Label htmlFor={`subQ-${subQ.id}-select`}></Label>
          <select
            className="mt-1 block w-full border rounded px-3 py-2 text-sm"
          >
            <option value="">- Select Sub-Division -</option>
            <option value="Sub-Division1">Sub-Division 1</option>
            <option value="Sub-Division2">Sub-Division 2</option>
            <option value="Sub-Division3">Sub-Division 3</option>
          </select>
        </div>
      )}

      {subQ.type === "date" && <Input type="date" />}

      {subQ.type === "time" && <Input type="time" />}

      {subQ.type === "datetime" && <Input type="datetime-local" />}

      {subQ.type === "upload_image" && (
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
      )}

      {subQ.type === "upload_video" && (
        <div className="border border-black border-dotted  rounded-md p-6 flex flex-col items-center justify-center">
          <VideoIcon className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground text-center">
            {subQ.requiresLive
              ? "Record a video"
              : "Tap to upload a video"}
            <br />
          </p>
        </div>
      )}

      {subQ.type === "upload_file" && (
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
      )}


      {subQ.type === "signature" && (
        <div className="space-y-3">
          {/* Signature Pad UI */}
          <div className="border-2 border-dotted border-gray-400 rounded-md h-16 flex items-center justify-center cursor-pointer hover:bg-blue-100 transition">
            <div className="flex items-center gap-2 text-primary">
              <PencilIcon className="h-4 w-4" />
              <span className="text-sm font-medium">Tap to sign</span>
            </div>
          </div>
          {/* Full Name Field */}
          <div>
            <Label htmlFor={`question-${subQ.id}-fullname`} className="text-sm">
              Full Name
            </Label>
            <Input
              id={`question-${subQ.id}-fullname`}
              placeholder="Enter full name"
              className="mt-1"
            // value={question.fullName || ""}
            // onChange={(e) =>
            //   handleQuestionUpdate(activeStage, question.id, "fullName", e.target.value)
            // }
            />
            <p className="text-xs text-muted-foreground mt-1">
              Name field is optional if this is submitter's signature.
            </p>
          </div>
        </div>
      )}

      {subQ.type === "qr_code" && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 border rounded-md px-4 py-2">
            <div
              className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary
                   hover:bg-primary hover:text-white transition-colors duration-200 cursor-pointer"
            >                                        <QrCodeIcon className="h-5 w-5" />
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
      )}

      {subQ.type === "location" && (
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
      )}

      {subQ.type === "linear_scale" && (
        <div className="w-full mt-4">
          {/* Left and Right Labels */}
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>{subQ.leftLabel || ""}</span>
            <span>{subQ.rightLabel || ""}</span>
          </div>

          {/* Radio Scale with line */}
          <div className="relative w-full">
            {/* Horizontal Line */}
            <div className="absolute top-[6px] left-0 right-0 h-[2px] bg-gray-300 z-0" />

            {/* Radio Buttons */}
            <div className="flex items-center justify-between relative z-10">
              {Array.from(
                { length: (subQ.to ?? 4) - (subQ.from ?? 0) + 1 },
                (_, i) => (subQ.from ?? 0) + i
              ).map((value) => (
                <label key={value} className="flex flex-col items-center text-sm">
                  <input
                    type="radio"
                    name={`linear-${subQ.id}`}
                    value={value}
                    className="form-radio text-blue-600 w-4 h-4"
                  // onChange={(e) =>
                  //   handleQuestionUpdate(stage.id, question.id, "previewAnswer", e.target.value)
                  // }
                  // checked={question.selectedValue === value}
                  />
                  <span className="mt-1">{value}</span>
                </label>
              ))}
            </div>
          </div>

          {/* {isConditionalLogicMet(question) &&
            question.subQuestions?.map((subQ) => (
              <div key={subQ.id}>
                <ConditionalQuestion subQ={subQ} />
              </div>
            ))} */}
        </div>
      )}
      {subQ.type === "dropdown" && (
        <div>
          <Label className="text-white mb-1 block">{subQ.description}</Label>
          <Select
            value={subQ.previewAnswer?.toString() || ""}
          // onValueChange={(value) =>
          //   handleQuestionUpdate(stage.id, question.id, "previewAnswer", value)
          // }
          >
            <SelectTrigger className="bg-white text-black">
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {(subQ.options || []).map((option, index) => (
                <SelectItem key={index} value={option.toString()}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* {isConditionalLogicMet(question) &&
            question.subQuestions?.map((subQ) => (
              <div key={subQ.id}>
                <ConditionalQuestion subQ={subQ} />
              </div>
            ))} */}
        </div>
      )}

      {subQ.type === "formula" && (
        <div className="space-y-2">
          <Input disabled value="=[Field1] + [Field2]" />
          <p className="text-xs text-muted-foreground">
            Result will be calculated based on other field values
          </p>
        </div>
      )}

    </div>
  )
}
