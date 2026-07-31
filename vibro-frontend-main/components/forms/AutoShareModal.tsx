import React, { useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll"

interface AutoShareModalProps {
    title: string
    isOpen: boolean
    onClose: () => void
    items: { id: string; name: string }[]
    selected: string[]
    onChange: (newSelected: string[]) => void
    onSave?: () => void
}

const AutoShareModal: React.FC<AutoShareModalProps> = ({
    title,
    isOpen,
    onClose,
    items,
    selected,
    onChange,
    onSave,
}) => {
    const [searchTerm, setSearchTerm] = useState("")
    useLockBodyScroll(isOpen)
    if (!isOpen) return null

    const addItem = (id: string) => {
        if (!selected.includes(id)) {
            onChange([...selected, id])
        }
    }

    const removeItem = (id: string) => {
        onChange(selected.filter((s) => s !== id))
    }
    console.log("Users nnnjw??:", items)
    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-[650px] h-[500px] flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center mb-4 shrink-0">
                    <h2 className="text-lg font-semibold">
                        New responses are automatically shared to {title}
                    </h2>
                    <div className="flex items-center gap-3">
                         {/* Clear All Button */}
                        {selected.length > 0 && (
                            <button
                                onClick={() => onChange([])}
                                className="inline-flex items-center justify-center px-2 py-0.5 bg-red-500 text-white border border-red-400 text-sm rounded hover:bg-red-50 hover:text-red-600 transition-colors whitespace-nowrap"
                            >
                                Clear All
                            </button>
                        )}

                         {/* Close Button */}
                        <button onClick={onClose}>
                            <X className="h-6 w-6 bg-white text-red-500 border border-red-500 rounded-sm hover:bg-red-300 hover:text-white" />
                        </button>

                    </div>
                </div>

                {/* Search */}
                <input
                    type="text"
                    placeholder={`Search ${title.toLowerCase()}...`}
                    className="border p-2 rounded w-full mb-4 shrink-0"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />

                {/* Selected Chips */}
                {selected.length > 0 && (
                    <div className="flex flex-col gap-2 mb-4 shrink-0">
                        <div className="flex flex-wrap gap-2">
                            {selected.map((id) => {
                                const item = items.find((i) => i.id === id)
                                return (
                                    <span
                                        key={`selected-${id}`}
                                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center gap-1"
                                    >
                                        {item?.name || id}
                                        <button onClick={() => removeItem(id)}>
                                            <X className="h-4 w-4" />
                                        </button>
                                    </span>
                                )
                            })}
                        </div>

                        {/* Clear All Button */}
                        {/* <button
                            onClick={() => onChange([])}
                            className="inline-flex items-center justify-center px-2 py-0.5 border border-red-400 text-red-500 text-xs rounded hover:bg-red-50 hover:text-red-600 transition-colors whitespace-nowrap"
                        >
                            Clear
                        </button> */}
                    </div>
                )}

                {/* Scrollable List */}
                <div className="flex-1 overflow-y-auto border rounded mb-4">
                    {items
                        .filter(
                            (i) =>
                                (i.name?.toLowerCase() ?? "").includes(searchTerm.toLowerCase()) &&
                                !selected.includes(i.id)
                        )
                        .map((i) => (
                            <div
                                key={`list-${i.id}`}
                                className="cursor-pointer p-2 border-t-2 border-gray-100 text-black  hover:bg-gray-100 hover:text-gray-900"
                                onClick={() => addItem(i.id)}
                            >
                                {i.name}
                            </div>
                        ))}
                </div>

                {/* Footer Buttons */}
                <div className="flex justify-end gap-2 shrink-0">
                    <Button variant="outline" onClick={onClose}>
                        Close
                    </Button>
                    <Button className="bg-blue-500 text-white" onClick={() => {
                        if (onSave) {
                            onSave();
                        } else {
                            onClose();
                        }
                    }}>
                        Save Changes
                    </Button>
                </div>
            </div>
        </div>

    )
}

export default AutoShareModal
