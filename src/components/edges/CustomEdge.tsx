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
}) => {
  const [edgePath] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
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
      stroke: '#666322', // Gray color for normal
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
      <path
        id={id}
        style={edgeStyle}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
    </>
  );
};

export default CustomEdge;