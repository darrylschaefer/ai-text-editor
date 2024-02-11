import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import defaultStyles from '@components/style';
import { TextAlignCenter, TextAlignLeft, TextAlignRight, TextAlignJustify, TextBold, TextItalic, TextStrikethrough, TextUnderline, ChevronDown } from '@carbon/icons-react';
import { ListNode } from "@lexical/list";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";

import {
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  FORMAT_TEXT_COMMAND,
  FORMAT_ELEMENT_COMMAND,
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  $getNodeByKey,
  RangeSelection
} from "lexical";
import { $isLinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import {
  $isParentElementRTL,
  $wrapNodes,
  $isAtNodeEnd
} from "@lexical/selection";
import { $getNearestNodeOfType, mergeRegister } from "@lexical/utils";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
  $isListNode, insertList
} from "@lexical/list";
import { createPortal } from "react-dom";
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode
} from "@lexical/rich-text";
import {
  $createCodeNode,
  $isCodeNode,
  getDefaultCodeLanguage,
  getCodeLanguages
} from "@lexical/code";

const LowPriority = 1;

function Divider() {
    return <div className="divider" />;
  }
  
function getSelectedNode(selection: RangeSelection) {
    const anchor = selection.anchor;
    const focus = selection.focus;
    const anchorNode = selection.anchor.getNode();
    const focusNode = selection.focus.getNode();
    if (anchorNode === focusNode) {
      return anchorNode;
    }
    const isBackward = selection.isBackward();
    if (isBackward) {
      return $isAtNodeEnd(focus) ? anchorNode : focusNode;
    } else {
      return $isAtNodeEnd(anchor) ? focusNode : anchorNode;
    }
  }
  

  

  function BlockOptionsDropdownList({
    editor,
    blockType,
    toolbarRef,
    setShowBlockOptionsDropDown
  }: {
    editor: any;
    blockType: string;
    toolbarRef: any;
    setShowBlockOptionsDropDown: any;
    }) {
    const dropDownRef = useRef<HTMLDivElement>(null);
  
    useEffect(() => {
      const toolbar = toolbarRef.current;
      const dropDown = dropDownRef.current;
  
      if (toolbar !== null && dropDown !== null) {
        const { top, left } = toolbar.getBoundingClientRect();
          //commented to force clearing of typescript errors
         dropDown.style.top = `calc(${top + 0}px + 4rem)`;
         dropDown.style.left = `calc(${left}px + 6rem)`;
      }
    }, [dropDownRef, toolbarRef]);
  
    useEffect(() => {
      const dropDown = dropDownRef.current;
      const toolbar = toolbarRef.current;
  
      if (dropDown !== null && toolbar !== null) {
        const handle = (event: any) => {
          const target = event.target;
  
          //commented to force clearing of typescript errors
  
           if (!dropDown.contains(target) && !toolbar.contains(target)) {
             setShowBlockOptionsDropDown(false);
           }
        };
        document.addEventListener("click", handle);
  
        return () => {
          document.removeEventListener("click", handle);
        };
      }
    }, [dropDownRef, setShowBlockOptionsDropDown, toolbarRef]);
  
    const formatParagraph = () => {
      if (blockType !== "paragraph") {
        editor.update(() => {
          const selection = $getSelection();
  
          if ($isRangeSelection(selection)) {
            $wrapNodes(selection, () => $createParagraphNode());
          }
        });
      }
      setShowBlockOptionsDropDown(false);
    };
  
    const formatLargeHeading = () => {
      if (blockType !== "h1") {
        editor.update(() => {
          const selection = $getSelection();
  
          if ($isRangeSelection(selection)) {
            $wrapNodes(selection, () => $createHeadingNode("h1"));
          }
        });
      }
      setShowBlockOptionsDropDown(false);
    };
  
    const formatSmallHeading = () => {
      if (blockType !== "h2") {
        editor.update(() => {
          const selection = $getSelection();
  
          if ($isRangeSelection(selection)) {
            $wrapNodes(selection, () => $createHeadingNode("h2"));
          }
        });
      }
      setShowBlockOptionsDropDown(false);
    };
    
    editor.registerCommand(INSERT_UNORDERED_LIST_COMMAND, () => {
      insertList(editor, 'bullet');
      return true;
  }, LowPriority);
  
  editor.registerCommand(INSERT_ORDERED_LIST_COMMAND, () => {
    insertList(editor, 'number');
    return true;
  }, LowPriority);
  
  
    const formatBulletList = () => {
      if (blockType !== "ul") {
        editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND);
      } else {
        editor.dispatchCommand(REMOVE_LIST_COMMAND);
      }
      setShowBlockOptionsDropDown(false);
    };
  
    const formatNumberedList = () => {
      if (blockType !== "ol") {
        editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND);
      } else {
        editor.dispatchCommand(REMOVE_LIST_COMMAND);
      }
      setShowBlockOptionsDropDown(false);
    };
  
    const formatQuote = () => {
      if (blockType !== "quote") {
        editor.update(() => {
          const selection = $getSelection();
  
          if ($isRangeSelection(selection)) {
            $wrapNodes(selection, () => $createQuoteNode());
          }
        });
      }
      setShowBlockOptionsDropDown(false);
    };
  
    const formatCode = () => {
      if (blockType !== "code") {
        editor.update(() => {
          const selection = $getSelection();
  
          if ($isRangeSelection(selection)) {
            $wrapNodes(selection, () => $createCodeNode());
          }
        });
      }
      setShowBlockOptionsDropDown(false);
    };
  
    return (
      <div className="dropdown" ref={dropDownRef}>
        <button className="item" onClick={formatParagraph}>
          <span className="icon paragraph" />
          <span className="text">Normal</span>
          {blockType === "paragraph" && <span className="active" />}
        </button>
        <button className="item" onClick={formatLargeHeading}>
          <span className="icon large-heading" />
          <span className="text">Large Heading</span>
          {blockType === "h1" && <span className="active" />}
        </button>
        <button className="item" onClick={formatSmallHeading}>
          <span className="icon small-heading" />
          <span className="text">Small Heading</span>
          {blockType === "h2" && <span className="active" />}
        </button>
        <button className="item" onClick={formatBulletList}>
          <span className="icon bullet-list" />
          <span className="text">Bullet List</span>
          {blockType === "ul" && <span className="active" />}
        </button>
        <button className="item" onClick={formatNumberedList}>
          <span className="icon numbered-list" />
          <span className="text">Numbered List</span>
          {blockType === "ol" && <span className="active" />}
        </button>
        <button className="item" onClick={formatQuote}>
          <span className="icon quote" />
          <span className="text">Quote</span>
          {blockType === "quote" && <span className="active" />}
        </button>
        {/* <button className="item" onClick={formatCode}>
          <span className="icon code" />
          <span className="text">Code Block</span>
          {blockType === "code" && <span className="active" />}
        </button> */}
      </div>
    );
  }

  


const supportedBlockTypes = new Set([
    "paragraph",
    "quote",
    "code",
    "h1",
    "h2",
    "ul",
    "ol"
  ]);
  
  const blockTypeToBlockName: Record<string, string> = {
    code: "Code Block",
    h1: "Large Heading",
    h2: "Small Heading",
    h3: "Heading",
    h4: "Heading",
    h5: "Heading",
    ol: "Numbered List",
    paragraph: "Normal",
    quote: "Quote",
    ul: "Bulleted List"
  };
  


function EditorToolbar() {
    const [editor] = useLexicalComposerContext();
    const toolbarRef = useRef(null);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);
    const [blockType, setBlockType] = useState("paragraph");
    const [selectedElementKey, setSelectedElementKey] = useState("" as string | null);
    const [showBlockOptionsDropDown, setShowBlockOptionsDropDown] = useState(
      false
    );
    const [codeLanguage, setCodeLanguage] = useState("");
    const [isRTL, setIsRTL] = useState(false);
    const [isLink, setIsLink] = useState(false);
    const [isBold, setIsBold] = useState(false);
    const [isItalic, setIsItalic] = useState(false);
    const [isUnderline, setIsUnderline] = useState(false);
    const [isStrikethrough, setIsStrikethrough] = useState(false);
    const [isCode, setIsCode] = useState(false);
  
    const updateToolbar = useCallback(() => {
      const selection = $getSelection();
  
      if ($isRangeSelection(selection)) {
        const anchorNode = selection.anchor.getNode();
        const element =
          anchorNode.getKey() === "root"
            ? anchorNode
            : anchorNode.getTopLevelElementOrThrow();
        const elementKey = element.getKey();
        const elementDOM = editor.getElementByKey(elementKey);
        if (elementDOM !== null) {
          setSelectedElementKey(elementKey);
          if ($isListNode(element)) {
            const parentList = $getNearestNodeOfType(anchorNode, ListNode);
            const type = parentList ? parentList.getTag() : element.getTag();
            setBlockType(type);
          } else {
            const type = $isHeadingNode(element)
              ? element.getTag()
              : element.getType();
            setBlockType(type);
            if ($isCodeNode(element)) {
              setCodeLanguage(element.getLanguage() || getDefaultCodeLanguage());
            }
          }
        }
        // Update text format
        setIsBold(selection.hasFormat("bold"));
        setIsItalic(selection.hasFormat("italic"));
        setIsUnderline(selection.hasFormat("underline"));
        setIsStrikethrough(selection.hasFormat("strikethrough"));
        setIsCode(selection.hasFormat("code"));
        setIsRTL($isParentElementRTL(selection));
  
  
        // Update links
        const node = getSelectedNode(selection);
        const parent = node.getParent();
        if ($isLinkNode(parent) || $isLinkNode(node)) {
          setIsLink(true);
        } else {
          setIsLink(false);
        }
      }
    }, [editor]);
  
    useEffect(() => {
  
      return mergeRegister(
        editor.registerUpdateListener(({ editorState }) => {
          editorState.read(() => {
            updateToolbar();
          });
        }),
        editor.registerCommand(
          SELECTION_CHANGE_COMMAND,
          (_payload, newEditor) => {
            updateToolbar();
            return false;
          },
          LowPriority
        ),
        editor.registerCommand(
          CAN_UNDO_COMMAND,
          (payload) => {
            setCanUndo(payload);
            return false;
          },
          LowPriority
        ),
        editor.registerCommand(
          CAN_REDO_COMMAND,
          (payload) => {
            setCanRedo(payload);
            return false;
          },
          LowPriority
        )
      );
    }, [editor, updateToolbar]);
  
    const codeLanguges = useMemo(() => getCodeLanguages(), []);
    const onCodeLanguageSelect = useCallback(
      (e: any) => {
        editor.update(() => {
          if (selectedElementKey !== null) {
            const node = $getNodeByKey(selectedElementKey);
            if ($isCodeNode(node)) {
              node.setLanguage(e.target.value);
            }
          }
        });
      },
      [editor, selectedElementKey]
    );
  
    const insertLink = useCallback(() => {
      if (!isLink) {
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, "https://");
      } else {
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
      }
    }, [editor, isLink]);
  
    return (
      <div className="flex p-2 z-10 bg-gray-900 border-white/10 border-b gap-1 items-center w-full justify-between" ref={toolbarRef}>
        <div className="flex gap-1 snap-x w-full overflow-scroll md:overflow-hidden">
        <button
          disabled={!canUndo}
          onClick={() => {
            editor.dispatchCommand(UNDO_COMMAND, undefined);
          }}
          className={defaultStyles.buttonStyle}
          aria-label="Undo"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-arrow-counterclockwise" viewBox="0 0 16 16">
            <path fillRule="evenodd" d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2v1z"/>
            <path d="M8 4.466V.534a.25.25 0 0 0-.41-.192L5.23 2.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 4.466z"/>
          </svg>
        </button>
        <button
          disabled={!canRedo}
          onClick={() => {
            editor.dispatchCommand(REDO_COMMAND, undefined);
          }}
          className={defaultStyles.buttonStyle}
          aria-label="Redo"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-arrow-clockwise" viewBox="0 0 16 16">
    <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
    <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
  </svg>
        </button>
        <Divider />
        {supportedBlockTypes.has(blockType) && (
          <>
            <button
              className={defaultStyles.buttonStyle}
              onClick={() =>
                setShowBlockOptionsDropDown(!showBlockOptionsDropDown)
              }
              aria-label="Formatting Options"
            >
  
            {blockType === "paragraph" ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-text-paragraph" viewBox="0 0 16 16">
                <path fillRule="evenodd" d="M2 12.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm0-3a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5zm0-3a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5zm4-3a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5z"/>
              </svg> ) : (
          ""    
              )
            }
  
            {blockType === "quote" ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-chat-square-quote" viewBox="0 0 16 16">
       <path d="M14 1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-2.5a2 2 0 0 0-1.6.8L8 14.333 6.1 11.8a2 2 0 0 0-1.6-.8H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2.5a1 1 0 0 1 .8.4l1.9 2.533a1 1 0 0 0 1.6 0l1.9-2.533a1 1 0 0 1 .8-.4H14a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/>
    <path d="M7.066 4.76A1.665 1.665 0 0 0 4 5.668a1.667 1.667 0 0 0 2.561 1.406c-.131.389-.375.804-.777 1.22a.417.417 0 1 0 .6.58c1.486-1.54 1.293-3.214.682-4.112zm4 0A1.665 1.665 0 0 0 8 5.668a1.667 1.667 0 0 0 2.561 1.406c-.131.389-.375.804-.777 1.22a.417.417 0 1 0 .6.58c1.486-1.54 1.293-3.214.682-4.112z"/>
  </svg>
              ) : (""
              )
            }
  
            {/* {blockType === "code" ? (
              <svg xmlns="http://www.3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-journal-code" viewBox="0 0 16 16">
              <path fillRule="evenodd" d="M8.646 5.646a.5.5 0 0 1 .708 0l2 2a.5.5 0 0 1 0 .708l-2 2a.5.5 0 0 1-.708-.708L10.293 8 8.646 6.354a.5.5 0 0 1 0-.708zm-1.292 0a.5.5 0 0 0-.708 0l-2 2a.5.5 0 0 0 0 .708l2 2a.5.5 0 0 0 .708-.708L5.707 8l1.647-1.646a.5.5 0 0 0 0-.708z"/>
              <path d="M3 0h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-1h1v1a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v1H1V2a2 2 0 0 1 2-2z"/>
              <path d="M1 5v-.5a.5.5 0 0 1 1 0V5h.5a.5.5 0 0 1 0 1h-2a.5.5 0 0 1 0-1H1zm0 3v-.5a.5.5 0 0 1 1 0V8h.5a.5.5 0 0 1 0 1h-2a.5.5 0 0 1 0-1H1zm0 3v-.5a.5.5 0 0 1 1 0v.5h.5a.5.5 0 0 1 0 1h-2a.5.5 0 0 1 0-1H1z"/>
            </svg>
              ) : (""
              )
  
            } */}
  
            {blockType === "ul" ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-list-ul" viewBox="0 0 16 16">
              <path fillRule="evenodd" d="M5 11.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm-3 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm0 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm0 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
            </svg>
              ) : (
              ""
              )
            }
  
            {blockType === "ol" ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-list-ol" viewBox="0 0 16 16">
              <path fillRule="evenodd" d="M5 11.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5z"/>
              <path d="M1.713 11.865v-.474H2c.217 0 .363-.137.363-.317 0-.185-.158-.31-.361-.31-.223 0-.367.152-.373.31h-.59c.016-.467.373-.787.986-.787.588-.002.954.291.957.703a.595.595 0 0 1-.492.594v.033a.615.615 0 0 1 .569.631c.003.533-.502.8-1.051.8-.656 0-1-.37-1.008-.794h.582c.008.178.186.306.422.309.254 0 .424-.145.422-.35-.002-.195-.155-.348-.414-.348h-.3zm-.004-4.699h-.604v-.035c0-.408.295-.844.958-.844.583 0 .96.326.96.756 0 .389-.257.617-.476.848l-.537.572v.03h1.054V9H1.143v-.395l.957-.99c.138-.142.293-.304.293-.508 0-.18-.147-.32-.342-.32a.33.33 0 0 0-.342.338v.041zM2.564 5h-.635V2.924h-.031l-.598.42v-.567l.629-.443h.635V5z"/>
            </svg>
              ) : (
              ""
              )
            }
  
            {blockType === "h1" ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-type-h1" viewBox="0 0 16 16">
              <path d="M8.637 13V3.669H7.379V7.62H2.758V3.67H1.5V13h1.258V8.728h4.62V13h1.259zm5.329 0V3.669h-1.244L10.5 5.316v1.265l2.16-1.565h.062V13h1.244z"/>
            </svg>
              ) : (
              ""
              )
            }
  
            {blockType === "h2" ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-type-h2" viewBox="0 0 16 16">
              <path d="M7.638 13V3.669H6.38V7.62H1.759V3.67H.5V13h1.258V8.728h4.62V13h1.259zm3.022-6.733v-.048c0-.889.63-1.668 1.716-1.668.957 0 1.675.608 1.675 1.572 0 .855-.554 1.504-1.067 2.085l-3.513 3.999V13H15.5v-1.094h-4.245v-.075l2.481-2.844c.875-.998 1.586-1.784 1.586-2.953 0-1.463-1.155-2.556-2.919-2.556-1.941 0-2.966 1.326-2.966 2.74v.049h1.223z"/>
            </svg>
              ) : (
              ""
              )
            }
              <span className="text leading-none">
                {blockTypeToBlockName[blockType]}
                </span>
              <ChevronDown size={16} />
            </button>
            {showBlockOptionsDropDown &&
              createPortal(
                <BlockOptionsDropdownList
                  editor={editor}
                  blockType={blockType}
                  toolbarRef={toolbarRef}
                  setShowBlockOptionsDropDown={setShowBlockOptionsDropDown}
                />,
                document.body
              )}
            <Divider />
          </>
        )}
        {blockType === "code" ? (
          <>
            {/* <Select
              className="toolbar-item code-language"
              onChange={onCodeLanguageSelect}
              options={codeLanguges}
              value={codeLanguage}
            />
            <i className="chevron-down inside" /> */}
          </>
        ) : (
          <>
            <button
              onClick={() => {
                editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold");
              }}
              className={defaultStyles.buttonStyle}
              aria-label="Format Bold"
            >
              <TextBold size={16} />
            </button>
            <button
              onClick={() => {
                editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic");
              }}
              className={defaultStyles.buttonStyle}
              aria-label="Format Italics"
            >
              <TextItalic size={16} />
            </button>
            <button
              onClick={() => {
                editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline");
              }}
              className={defaultStyles.buttonStyle}
              aria-label="Format Underline"
            >
              <TextUnderline size={16} />
            </button>
            <button
              onClick={() => {
                editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough");
              }}
              className={defaultStyles.buttonStyle}
              aria-label="Format Strikethrough"
            >
              <TextStrikethrough size={16} />
            </button>
            <button
              onClick={() => {
                editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "left");
              }}
              className={defaultStyles.buttonStyle}
              aria-label="Left Align"
            >
              <TextAlignLeft size={16} />
            </button>
            <button
              onClick={() => {
                editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "center");
              }}
              className={defaultStyles.buttonStyle}
              aria-label="Center Align"
            >
              <TextAlignCenter size={16} />
            </button>
            <button
              onClick={() => {
                editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "right");
              }}
              className={defaultStyles.buttonStyle}
              aria-label="Right Align"
            >
              <TextAlignRight size={16} />
            </button>
            <button
              onClick={() => {
                editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "justify");
              }}
              className={defaultStyles.buttonStyle}
              aria-label="Justify Align"
            >
              <TextAlignJustify size={16} />
            </button>
          </>
        )}
      </div>
      {/* <div>
        <ActionBar />
      </div> */}
      </div>
    );
  }


  export default EditorToolbar;