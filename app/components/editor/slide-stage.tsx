import Konva from "konva";
import { useEffect, useRef, useState } from "react";
import {
  Image as KonvaImage,
  Layer,
  Rect,
  Stage,
  Text,
  Transformer,
} from "react-konva";
import { SLIDE_HEIGHT, SLIDE_WIDTH } from "~/lib/scene";
import {
  type ImageElement,
  type RectElement,
  resolveTextEffect,
  type SlideDoc,
  type SlideElement,
  type TextElement,
} from "~/lib/slide-doc";
import { useGoogleFonts } from "./use-google-fonts";

// The interactive canvas. Coordinates are in the 960×540 slide space; the whole
// Stage is scaled to fit its container via `scale`. Never imported on the server
// (it's lazy-loaded inside a ClientOnly).

type NodeChange = (id: string, patch: Partial<SlideElement>) => void;

function useHtmlImage(src: string): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) return;
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    const done = () => setImg(image);
    image.addEventListener("load", done);
    image.src = src;
    return () => image.removeEventListener("load", done);
  }, [src]);
  return img;
}

/** Convert a transform (which Konva applies as scale) back into width/height so
 * our model stays scale-free. */
function commitTransform(node: Konva.Node, onChange: NodeChange, id: string) {
  const scaleX = node.scaleX();
  const scaleY = node.scaleY();
  node.scaleX(1);
  node.scaleY(1);
  onChange(id, {
    x: Math.round(node.x()),
    y: Math.round(node.y()),
    width: Math.max(8, Math.round(node.width() * scaleX)),
    height: Math.max(8, Math.round(node.height() * scaleY)),
    rotation: Math.round(node.rotation()),
  });
}

/** Text resizes its box, not its glyphs: the horizontal drag changes the wrap
 * width (font size is untouched) and the height auto-fits the wrapped text — so
 * the box is never smaller than the text it holds. */
function commitTextTransform(node: Konva.Node, onChange: NodeChange, id: string) {
  const scaleX = node.scaleX();
  node.scaleX(1);
  node.scaleY(1);
  const width = Math.max(24, Math.round(node.width() * scaleX));
  node.width(width);
  onChange(id, {
    x: Math.round(node.x()),
    y: Math.round(node.y()),
    width,
    height: Math.round(node.height()),
    rotation: Math.round(node.rotation()),
  });
}

interface NodeProps<T> {
  el: T;
  onSelect: (id: string) => void;
  onChange: NodeChange;
  register: (id: string, node: Konva.Node | null) => void;
}

function commonHandlers(
  el: SlideElement,
  onSelect: (id: string) => void,
  onChange: NodeChange,
) {
  return {
    draggable: true,
    onMouseDown: () => onSelect(el.id),
    onTap: () => onSelect(el.id),
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) =>
      onChange(el.id, {
        x: Math.round(e.target.x()),
        y: Math.round(e.target.y()),
      }),
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) =>
      commitTransform(e.target, onChange, el.id),
  };
}

function RectNode({ el, onSelect, onChange, register }: NodeProps<RectElement>) {
  return (
    <Rect
      ref={(n) => register(el.id, n)}
      x={el.x}
      y={el.y}
      width={el.width}
      height={el.height}
      rotation={el.rotation}
      fill={el.fill}
      cornerRadius={el.cornerRadius}
      {...commonHandlers(el, onSelect, onChange)}
    />
  );
}

function shadowFor(el: TextElement) {
  const fx = resolveTextEffect(el.effect);
  if (fx && (fx.type === "shadow" || fx.type === "glow")) {
    return {
      shadowEnabled: true,
      shadowColor: fx.color,
      shadowBlur: fx.blur,
      shadowOffsetX: fx.offset,
      shadowOffsetY: fx.offset,
      shadowOpacity: fx.opacity,
    };
  }
  return { shadowEnabled: false };
}

function TextNode({ el, onSelect, onChange, register }: NodeProps<TextElement>) {
  const ref = useRef<Konva.Text | null>(null);
  const fx = resolveTextEffect(el.effect);
  const blurAmount = fx?.type === "blur" ? fx.amount : 0;

  // The Blur filter needs the node cached; re-cache whenever its look changes.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (blurAmount > 0) {
      node.cache({ offset: Math.ceil(blurAmount) + 4, pixelRatio: 2 });
    } else {
      node.clearCache();
    }
    node.getLayer()?.batchDraw();
  }, [
    blurAmount,
    el.text,
    el.fontSize,
    el.fontFamily,
    el.fontStyle,
    el.width,
    el.fill,
    el.align,
  ]);

  return (
    <Text
      ref={(n) => {
        ref.current = n;
        register(el.id, n);
      }}
      x={el.x}
      y={el.y}
      width={el.width}
      rotation={el.rotation}
      text={el.text}
      fontSize={el.fontSize}
      fontFamily={el.fontFamily}
      fontStyle={el.fontStyle}
      align={el.align}
      fill={el.fill}
      filters={blurAmount > 0 ? [Konva.Filters.Blur] : undefined}
      blurRadius={blurAmount}
      {...shadowFor(el)}
      {...commonHandlers(el, onSelect, onChange)}
      onTransformEnd={(e) => commitTextTransform(e.target, onChange, el.id)}
    />
  );
}

function ImageNode({
  el,
  onSelect,
  onChange,
  register,
}: NodeProps<ImageElement>) {
  const image = useHtmlImage(el.src);
  if (!image) {
    return (
      <Rect
        ref={(n) => register(el.id, n)}
        x={el.x}
        y={el.y}
        width={el.width}
        height={el.height}
        rotation={el.rotation}
        fill="#e9ebef"
        cornerRadius={8}
        {...commonHandlers(el, onSelect, onChange)}
      />
    );
  }
  return (
    <KonvaImage
      ref={(n) => register(el.id, n)}
      image={image}
      x={el.x}
      y={el.y}
      width={el.width}
      height={el.height}
      rotation={el.rotation}
      {...commonHandlers(el, onSelect, onChange)}
    />
  );
}

export interface SlideStageProps {
  doc: SlideDoc;
  selectedId: string | null;
  scale: number;
  onSelect: (id: string | null) => void;
  onChange: NodeChange;
}

export default function SlideStage({
  doc,
  selectedId,
  scale,
  onSelect,
  onChange,
}: SlideStageProps) {
  const nodes = useRef<Record<string, Konva.Node>>({});
  const trRef = useRef<Konva.Transformer>(null);
  const layerRef = useRef<Konva.Layer>(null);

  // Load the fonts this slide uses; Konva won't reflow when a webfont arrives
  // late, so redraw the layer each time one becomes ready.
  const fontTick = useGoogleFonts(
    doc.elements.flatMap((el) => (el.type === "text" ? [el.fontFamily] : [])),
  );
  useEffect(() => {
    layerRef.current?.batchDraw();
  }, [fontTick]);

  const register = (id: string, node: Konva.Node | null) => {
    if (node) nodes.current[id] = node;
    else delete nodes.current[id];
  };

  // Attach the transformer to the selected node whenever selection or the doc
  // changes (elements may have been added/removed).
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const selected = selectedId
      ? doc.elements.find((el) => el.id === selectedId)
      : null;
    const target = selectedId ? nodes.current[selectedId] : null;
    tr.nodes(target ? [target] : []);
    // Text only gets side handles (resize the box → re-wrap); shapes/images get
    // the full set of corner + side handles (scale).
    tr.enabledAnchors(
      selected?.type === "text"
        ? ["middle-left", "middle-right"]
        : [
            "top-left",
            "top-center",
            "top-right",
            "middle-left",
            "middle-right",
            "bottom-left",
            "bottom-center",
            "bottom-right",
          ],
    );
    tr.getLayer()?.batchDraw();
  }, [selectedId, doc]);

  return (
    <Stage
      width={SLIDE_WIDTH * scale}
      height={SLIDE_HEIGHT * scale}
      scaleX={scale}
      scaleY={scale}
      onMouseDown={(e) => {
        if (e.target === e.target.getStage()) onSelect(null);
      }}
    >
      <Layer ref={layerRef}>
        <Rect
          x={0}
          y={0}
          width={SLIDE_WIDTH}
          height={SLIDE_HEIGHT}
          fill={doc.background}
          onMouseDown={() => onSelect(null)}
        />
        {doc.elements.map((el) => {
          if (el.type === "rect")
            return (
              <RectNode
                key={el.id}
                el={el}
                onSelect={onSelect}
                onChange={onChange}
                register={register}
              />
            );
          if (el.type === "image")
            return (
              <ImageNode
                key={el.id}
                el={el}
                onSelect={onSelect}
                onChange={onChange}
                register={register}
              />
            );
          return (
            <TextNode
              key={el.id}
              el={el}
              onSelect={onSelect}
              onChange={onChange}
              register={register}
            />
          );
        })}
        <Transformer
          ref={trRef}
          rotationSnaps={[0, 90, 180, 270]}
          anchorStroke="#8b3dff"
          anchorFill="#ffffff"
          anchorSize={9}
          borderStroke="#8b3dff"
          borderStrokeWidth={1.5}
          boundBoxFunc={(oldBox, newBox) =>
            newBox.width < 12 || newBox.height < 12 ? oldBox : newBox
          }
        />
      </Layer>
    </Stage>
  );
}
