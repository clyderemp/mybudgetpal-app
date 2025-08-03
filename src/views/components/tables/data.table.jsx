import React, { useState, useMemo, useEffect } from "react";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import { Box, Button, Stack } from "@mui/material";
import { Eye, Edit, Trash2, Plus } from "lucide-react";
import { useTextUtils } from "@/utils/text.utils";
import { useAuth } from "@/context/auth.provider";
import { useModal } from "@/context/modal.provider";
import DynamicForm from "../forms/dynamic.form";

const DataTable = ({
  schema = {},
  data = [],
  rawData = [],
  onSubmit = () => {},
  onView,
  onDelete,
  onRowClick,
  showActions = false,
  showAddButton = false,
}) => {
  const [rows, setRows] = useState([]);
  const { openModal, closeModal } = useModal();

  useEffect(() => {
    if (!data.length) {
      setRows([]);
      return;
    }

    // Flatten data for DataGrid rows (assume data structure: { key: { value, type, ... } })
    const transformed = data.map((row, index) => {
      const flatRow = { id: index + 1 }; // Ensure each row has an id
      Object.entries(row).forEach(([key, val]) => {
        flatRow[key] = val?.value ?? "";
      });
      return flatRow;
    });

    setRows(transformed);
  }, [data]);

  const handleOpenDynamicForm = (row = {}) => {
    // Find the original row data from data by matching id if possible
    const originalRow = rawData.find((d, idx) => d?.id === row._id) || {};
    openModal(
      <DynamicForm
        schema={schema}
        defaultData={originalRow}
        onSubmit={(e) => {
          onSubmit({ ...originalRow, ...e });
        }}
        onCancel={() => closeModal()}
      />
    );
  };

  const handleAddUser = () => {
    // Open DynamicForm with no default data for new user
    openModal(
      <DynamicForm
        schema={schema}
        defaultData={{}} // empty object for new user
        onSubmit={onSubmit}
      />
    );
  };

  const columns = useMemo(() => {
    if (!rows.length) return [];

    // Generate columns from schema keys and use schema labels
    const dataColumns = Object.keys(schema).map((key) => ({
      field: key,
      headerName:
        schema[key]?.label || useTextUtils.capitalize(key).replace(/_/g, " "),
      flex: 1,
    }));

    if (showActions) {
      dataColumns.push({
        field: "actions",
        headerName: "",
        sortable: false,
        filterable: false,
        width: 120,
        renderCell: (params) => (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 0.5, // Smaller gap (theme spacing = 2px)
              width: "100%",
              height: "100%",
            }}
          >
            {onView && (
              <Button
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onView(params.row);
                }}
                sx={{ minWidth: "auto", padding: "10px" }}
              >
                <Eye size={16} />
              </Button>
            )}
            <Button
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenDynamicForm(params.row);
              }}
              sx={{ minWidth: "auto", padding: "10px" }}
            >
              <Edit size={16} color="orange" />
            </Button>
            {onDelete && (
              <Button
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(params.row);
                  // setRows((prev) => prev.filter((r) => r.id !== params.row.id));
                }}
                sx={{ minWidth: "auto", padding: "10px" }}
              >
                <Trash2 size={16} color="red" />
              </Button>
            )}
          </Box>
        ),
      });
    }

    return dataColumns;
  }, [rows, schema, onView, onDelete, showActions]);

  return (
    <Box sx={{ width: "100%", bgcolor: "background.paper", p: 2 }}>
      <Stack direction="row" justifyContent="flex-end" mb={1}>
        {showAddButton && (
          <Button
            variant="contained"
            startIcon={<Plus size={16} />}
            onClick={handleAddUser}
          >
            Add User
          </Button>
        )}
      </Stack>

      <DataGrid
        rows={rows}
        columns={columns}
        pageSize={10}
        rowsPerPageOptions={[5, 10, 20]}
        pagination
        disableSelectionOnClick
        onRowClick={(params) => onRowClick?.(params.row)}
        components={{ Toolbar: GridToolbar }}
      />
    </Box>
  );
};

export default DataTable;
