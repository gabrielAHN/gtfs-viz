import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from "@/components/ui/table"

function PopupTable({
    Data, ColumnsData, ColumnName
}){
    const ColumnData = ColumnName.reduce((obj, key, index) => {
        obj[key] = ColumnsData[index];
        return obj;
      }, {});
    
      return (
        <Table>
          <TableBody>
            {Object.entries(ColumnData).map(([column, value]) => (
              <TableRow key={column} className="bg-inherit">
                <TableCell component="th" scope="row" width="auto">
                  {column}
                </TableCell>
                <TableCell align="right" width="auto">
                  {String(Data[value])}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }
export default PopupTable;