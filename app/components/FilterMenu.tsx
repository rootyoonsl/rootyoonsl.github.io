"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from "react";

type FilterMenuOption = {
  value: string;
  count: number;
};

type FilterMenuProps = {
  label: string;
  value: string;
  options: readonly FilterMenuOption[];
  onChange: (value: string) => void;
};

export function FilterMenu({
  label,
  value,
  options,
  onChange,
}: FilterMenuProps) {
  const listboxId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selectedOption = options[selectedIndex] ?? {
    value,
    count: 0,
  };
  const columns = options.length > 10 ? 2 : 1;

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [isOpen]);

  function focusOption(index: number) {
    const safeIndex = Math.min(Math.max(index, 0), options.length - 1);
    optionRefs.current[safeIndex]?.focus();
  }

  function openAndFocus(index = selectedIndex) {
    setIsOpen(true);
    window.requestAnimationFrame(() => focusOption(index));
  }

  function closeAndRestoreFocus() {
    setIsOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function chooseOption(nextValue: string) {
    onChange(nextValue);
    closeAndRestoreFocus();
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openAndFocus(selectedIndex);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openAndFocus(selectedIndex);
    } else if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      setIsOpen(false);
    }
  }

  function handleOptionKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let nextIndex: number | null = null;

    if (event.key === "ArrowDown") {
      nextIndex = index + columns;
    } else if (event.key === "ArrowUp") {
      nextIndex = index - columns;
    } else if (event.key === "ArrowRight") {
      nextIndex = index + 1;
    } else if (event.key === "ArrowLeft") {
      nextIndex = index - 1;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = options.length - 1;
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeAndRestoreFocus();
      return;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      focusOption(nextIndex);
    }
  }

  function closeWhenFocusLeaves(event: FocusEvent<HTMLDivElement>) {
    if (
      event.relatedTarget instanceof Node &&
      rootRef.current?.contains(event.relatedTarget)
    ) {
      return;
    }
    setIsOpen(false);
  }

  return (
    <div
      className="filter-menu"
      data-open={isOpen || undefined}
      ref={rootRef}
      onBlur={closeWhenFocusLeaves}
    >
      <span className="filter-menu-label">{label}</span>
      <button
        className="filter-menu-trigger"
        type="button"
        ref={triggerRef}
        aria-label={`${label} 필터: ${selectedOption.value}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="filter-menu-trigger-value">
          {selectedOption.value}
        </span>
        <span className="filter-menu-trigger-count" aria-hidden="true">
          {selectedOption.count}
        </span>
        <span className="filter-menu-chevron" aria-hidden="true" />
      </button>

      {isOpen ? (
        <div
          className="filter-menu-popover"
          id={listboxId}
          role="listbox"
          aria-label={`${label} 목록`}
        >
          <div className="filter-menu-popover-heading" aria-hidden="true">
            <span>{label} 선택</span>
            <span>{options.length}</span>
          </div>
          <div
            className="filter-menu-options"
            data-columns={columns}
          >
            {options.map((option, index) => {
              const isSelected = option.value === selectedOption.value;

              return (
                <button
                  className="filter-menu-option"
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  data-selected={isSelected || undefined}
                  key={option.value}
                  ref={(node) => {
                    optionRefs.current[index] = node;
                  }}
                  onClick={() => chooseOption(option.value)}
                  onKeyDown={(event) =>
                    handleOptionKeyDown(event, index)
                  }
                >
                  <span className="filter-menu-option-name">
                    {option.value}
                  </span>
                  <span className="filter-menu-option-count" aria-hidden="true">
                    {option.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
