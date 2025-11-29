import React from 'react';
import { EdgeProps, getStraightPath } from 'reactflow';

const CustomEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style = {},
  markerEnd,
  selected,
  sourcePosition,
  targetPosition,
}) => {

  // Offset the targetX for the main edge path so it ends at the correct edge of the red line
  const RED_LINE_HALF = 10;
  // Calculate direction for horizontal offset
  let adjustedSourceX = sourceX;
  let adjustedTargetX = targetX;
  let targetLineStartX = targetX - RED_LINE_HALF;
  let targetLineEndX = targetX + RED_LINE_HALF;
  let sourceLineStartX = sourceX - RED_LINE_HALF;
  let sourceLineEndX = sourceX + RED_LINE_HALF;
  if (targetX > sourceX) {
    // Edge is going right, so offset to the right for the source and left for the target
    adjustedSourceX = sourceX + RED_LINE_HALF;
    adjustedTargetX = targetX - RED_LINE_HALF;
  } else if (targetX < sourceX) {
    // Edge is going left, so offset to the left for the source and right for the target
    adjustedSourceX = sourceX - RED_LINE_HALF;
    adjustedTargetX = targetX + RED_LINE_HALF;
  }
  const [edgePath] = getStraightPath({
    sourceX: adjustedSourceX,
    sourceY,
    targetX: adjustedTargetX,
    targetY,
  });


  // Debug: log selected state changes
  React.useEffect(() => {
    console.log('Edge', id, 'selected:', selected);
  }, [selected, id]);

  const edgeStyle = selected
    ? {
      ...style,
      strokeWidth: 3,
      strokeDasharray: '5,5',
      strokeDashoffset: 0,
      stroke: '#ff6b6b', // Red color for selected
      animation: 'march 1s linear infinite',
    }
    : {
      ...style,
      strokeWidth: 5,
      stroke: 'lime', // Gray color for normal
    };

  return (
    <>
      <defs>
        <style>
          {`
            @keyframes march {
              0% {
                stroke-dashoffset: 0;
              }
              100% {
                stroke-dashoffset: -10;
              }
            }
          `}
        </style>
      </defs>
      {/* Main edge line */}
      <path
        id={id}
        style={edgeStyle}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      {/* Add a short horizontal line at the target node */}
      {/* Add a short horizontal line at the source node */}
      <line
        x1={sourceLineStartX}
        y1={sourceY}
        x2={sourceLineEndX}
        y2={sourceY}
        stroke="red"
        strokeWidth={6}
      />
      {/* Add a short horizontal line at the target node */}
      <line
        x1={targetLineStartX}
        y1={targetY}
        x2={targetLineEndX}
        y2={targetY}
        stroke="purple"
        strokeWidth={6}
      />
    </>
  );
};

export default CustomEdge;