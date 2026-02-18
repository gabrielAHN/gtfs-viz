import {  useMemo } from "react";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import TableComponent from "@/components/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronUp, ChevronDown, Check, Trash, Skull, X } from "lucide-react";

function EditeTables(props) {
    const {
        FileTypes, setFileTypes, hasData, isLoading,
        isError, error, tableData, clickInfo, setClickInfo,
        columns, handleButtonClick, setIsExpanded,
        isExpanded, mutation
    } = props

    const buttonClasses = useMemo(() => {
        if (!hasData) {
            return "flex items-center rounded-sm justify-center w-12 h-12 bg-stone-300 text-stone-400 cursor-not-allowed dark:bg-stone-800";
        }
        return FileTypes.stops
            ? "flex items-center justify-center w-12 h-12 bg-green-500 hover:bg-green-600 rounded-sm"
            : "flex items-center justify-center w-12 h-12 bg-red-500 hover:bg-red-600 rounded-sm";
    }, [hasData, FileTypes.stops]);

    const triggerClasses = useMemo(() => {
        if (hasData && FileTypes.stops) {
            return "flex w-full justify-between items-center px-4 py-2.5 bg-stone-200 dark:bg-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-sm cursor-pointer transition-colors";
        }
        return "flex w-full justify-between items-center px-4 py-2.5 bg-stone-400 dark:bg-stone-600 cursor-not-allowed rounded-sm";
    }, [hasData, FileTypes.stops]);

    if (isLoading) return <Skeleton className="w-full h-40" />;
    if (isError)
        return <div className="text-red-500">Error: {error.message}</div>;
    return (
        <Collapsible
            open={isExpanded}
            onOpenChange={setIsExpanded}
            disabled={!hasData || FileTypes.stops}
            className="border rounded p-2"
        >
            <div className="flex gap-2">
                <button
                    onClick={handleButtonClick}
                    disabled={!hasData}
                    className={buttonClasses}
                >
                    {FileTypes.stops ? <Check size={24} /> : <X size={24} />}
                </button>
                <CollapsibleTrigger asChild>
                    <div className={triggerClasses}>
                        <div className="flex items-center w-full">
                            <span className="flex items-center">
                                {isExpanded && FileTypes.stops ? (
                                    <ChevronUp size={16} />
                                ) : (
                                    <ChevronDown size={16} />
                                )}
                                <span className="ml-1 text-lg font-bold">
                                    {hasData ? "Stop Edits" : "No Stop Edits"}
                                </span>
                            </span>
                        </div>
                    </div>
                </CollapsibleTrigger>
            </div>
            {hasData && FileTypes.stops && (
                <CollapsibleContent className="mt-2 w-full">
                    <TableComponent
                        data={tableData}
                        columns={columns}
                        ClickInfo={clickInfo}
                        setClickInfo={setClickInfo}
                    >
                        <div className="flex justify-start space-x-2 mt-4">
                            {clickInfo && (
                                <Button
                                    variant="delete"
                                    onClick={() => mutation.mutate('row')}
                                >
                                    <Trash className="mr-2 h-5 w-5" />
                                    Delete
                                </Button>
                            )}
                            <Button
                                variant="destructive"
                                onClick={() => mutation.mutate('table')}
                            >
                                <Skull className="mr-2 h-5 w-5" />
                                Delete All
                            </Button>
                        </div>
                    </TableComponent>
                </CollapsibleContent>
            )}
        </Collapsible>
    );
};

export default EditeTables;
