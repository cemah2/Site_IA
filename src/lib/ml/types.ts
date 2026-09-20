/** A labelled sample. `x` holds the feature values, `y` the class index. */
export interface Sample {
  /** Stable identity, so a point keeps its colour and tooltip across refits. */
  id: number;
  x: number[];
  /** Class index into the dataset's `classNames`. -1 means "unlabelled". */
  y: number;
}

export interface Dataset {
  name: string;
  samples: Sample[];
  featureNames: string[];
  classNames: string[];
  /** Per-feature [min, max] used for axes and for grid sweeps. */
  domain: [number, number][];
}

/** A model that assigns a class index to a feature vector. */
export interface Classifier {
  predict(x: number[]): number;
  /** Per-class scores in [0,1] summing to 1, when the model can produce them. */
  predictProba?(x: number[]): number[];
  readonly nClasses: number;
}

export interface Split {
  train: Sample[];
  test: Sample[];
}

/** 2-D scalar field sampled on a regular grid, used for decision surfaces. */
export interface Field {
  res: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  /** `res * res` entries, row-major, row 0 = yMin. */
  label: Int16Array;
  /** Margin between the best and second-best class at each cell (0 at the
   *  boundary, 1 when unanimous). Same layout. */
  confidence: Float32Array;
  /** Binary problems only: the continuous signed score p₁ − p₀, which lets the
   *  boundary be extracted as a smooth curve rather than a staircase. */
  score: Float32Array | null;
}
