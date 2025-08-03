import Card from "@/views/components/customs/ReportCard";
import Board from "@/views/components/customs/Trello";
import Button from "@/views/components/customs/customButton";
import data from "@/dummyData/reports";
import arrows from "@/assets/icons/arrows.png";
import { useModal } from "@/context/modal.provider";
import { useDateUtils } from "@/utils/date.utils";
import { useTextUtils } from "@/utils/text.utils";
import { useState, useEffect } from "react";

const uniques = new Set();
const filters = [
  { category: "control", content: "all" },
  { category: "type", content: "type1" },
  { category: "type", content: "type2" },
];
const sortOptions = ["date (default)"];

export default function Reports() {
  const [pending, setPending] = useState([]);
  const [resolving, setResolving] = useState([]);
  const [resolved, setResolved] = useState([]);
  const [renderedPending, setRenderedPending] = useState([]);
  const [renderedResolving, setRenderedResolving] = useState([]);
  const [renderedResolved, setRenderedResolved] = useState([]);
  const { openModal, closeModal } = useModal();
  const [panel, setPanel] = useState(null);
  const [filterBy, setFilterBy] = useState([]);
  const [sortBy, setSortBy] = useState("date (default)");
  const [sortAscending, setSortAscending] = useState(true);

  function selectionPanel(buttons, control, popup = null) {
    return (
      <div className="flex">
        <div className="flex space-x-2">
          {buttons.map((button) => (
            <Button
              key={control === "sort" ? button : button.content}
              className={
                control === "filter" &&
                button.category === "type" &&
                filterBy
                  .filter((filter) => filter.category === "type")
                  .map((filter) => filter.content)
                  .includes(button.content)
                  ? "bg-accent"
                  : "bg-primary"
              }
              label={useTextUtils.capitalize(button.content)}
              onClick={() => {
                if (control === "sort") {
                  setSortBy(button);
                  closeModal();
                } else if (control === "filter") {
                  if (button.category === "control") {
                    if (button.content === "all") {
                      setFilterBy([]);
                    }
                  } else if (button.category === "type") {
                    console.log(filterBy);
                    if (
                      filterBy
                        .filter((filter) => filter.category === "type")
                        .map((filter) => filter.content)
                        .includes(button.content)
                    ) {
                      setFilterBy((prev) =>
                        prev.filter(
                          (filter) => filter.content !== button.content
                        )
                      );
                    } else {
                      setFilterBy((prev) => [
                        ...prev,
                        {
                          category: "type",
                          content: button.content,
                        },
                      ]);
                    }
                  }
                }
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  useEffect(() => {
    let newPending = [];
    let newResolving = [];
    let newResolved = [];

    data.forEach((report) => {
      if (!uniques.has(report.id)) {
        uniques.add(report.id);
        switch (report.status) {
          case "pending":
            newPending.push(report);
            break;
          case "resolving":
            newResolving.push(report);
            break;
          case "resolved":
            newResolved.push(report);
          default:
            break;
        }
      }
    });
    if (newPending.length > 0) {
      setPending((prev) => [...prev, ...newPending]);
    }
    if (newResolving.length > 0) {
      setResolving((prev) => [...prev, ...newResolving]);
    }
    if (newResolved.length > 0) {
      setResolved((prev) => [...prev, ...newResolved]);
    }
  }, [data]);

  useEffect(() => {
    setRenderedPending(
      pending
        .filter((report) =>
          filterBy.every((filter) => {
            if (filter.category === "type") {
              return report.types.includes(filter.content);
            } else {
              return true;
            }
          })
        )
        .sort((before, after) => {
          if (sortBy === "date (default)") {
            if (sortAscending) {
              return useDateUtils.getDifference(
                before.date,
                after.date,
                "millisecond"
              );
            } else {
              return useDateUtils.getDifference(
                after.date,
                before.date,
                "millisecond"
              );
            }
          }
        })
    );
  }, [filterBy, pending, sortBy, sortAscending]);

  useEffect(() => {
    setRenderedResolving(
      resolving
        .filter((report) =>
          filterBy.every((filter) => {
            if (filter.category === "type") {
              return report.types.includes(filter.content);
            } else {
              return true;
            }
          })
        )
        .sort((before, after) => {
          if (sortBy === "date (default)") {
            if (sortAscending) {
              return useDateUtils.getDifference(
                before.date,
                after.date,
                "millisecond"
              );
            } else {
              return useDateUtils.getDifference(
                after.date,
                before.date,
                "millisecond"
              );
            }
          }
        })
    );
  }, [filterBy, resolving, sortBy, sortAscending]);

  useEffect(() => {
    setRenderedResolved(
      resolved
        .filter((report) =>
          filterBy.every((filter) => {
            if (filter.category === "type") {
              return report.types.includes(filter.content);
            } else {
              return true;
            }
          })
        )
        .sort((before, after) => {
          if (sortBy === "date (default)") {
            if (sortAscending) {
              return useDateUtils.getDifference(
                before.date,
                after.date,
                "millisecond"
              );
            } else {
              return useDateUtils.getDifference(
                after.date,
                before.date,
                "millisecond"
              );
            }
          }
        })
    );
  }, [filterBy, resolved, sortBy, sortAscending]);
  useEffect(() => {
    if (panel) {
      openModal(selectionPanel(panel.buttons, panel.control, panel.popup));
    }
  }, [panel, filterBy]);

  return (
    <>
      <div className="flex justify-between">
        <div className="w-1/2 flex space-x-2">
          <Button
            label="Filters"
            onClick={() =>
              setPanel({
                buttons: filters,
                control: "filter",
              })
            }
          />
          <Button
            label={"Sort by " + useTextUtils.capitalize(sortBy)}
            onClick={() => setPanel({ buttons: sortOptions, control: "sort" })}
          />
        </div>
        <div>
          <Button
            label={
              <img
                src={arrows}
                alt="sort direction arrows"
                className="w-6 h-6"
              />
            }
            onClick={() => setSortAscending(!sortAscending)}
          />
        </div>
      </div>
      <div className="flex">
        <Board title="Pending" colour="red">
          {renderedPending.map((report) => (
            <Card
              key={report.id}
              title={report.title}
              description={report.description}
              date={useDateUtils.getFormattedDateString(report.date)}
            />
          ))}
        </Board>
        <Board title="Resolving" colour="yellow">
          {renderedResolving.map((report) => (
            <Card
              key={report.id}
              title={report.title}
              description={report.description}
              date={useDateUtils.getFormattedDateString(report.date)}
            />
          ))}
        </Board>
        <Board title="Resolved" colour="green">
          {renderedResolved.map((report) => (
            <Card
              key={report.id}
              title={report.title}
              description={report.description}
              date={useDateUtils.getFormattedDateString(report.date)}
            />
          ))}
        </Board>
      </div>
    </>
  );
}
