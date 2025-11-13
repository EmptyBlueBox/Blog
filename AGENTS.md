# Repository Guidelines

## Coding Requirements

- When you write code:
  - Code must be in English.
  - Comments must be in English.
  - For every function/method, include detailed docstrings that explain purpose, parameters (type AND shape/dimensions, e.g., "- points (np.ndarray, shape=(N, 3), dtype=float32): Input point cloud."), and return values (type AND shape).
- Other code explanation outside coding files should be in Simplified Chinese.
- This is research code, so it doesn't need to be written with error handling, defensive programming, scalability, compatibility with legacy interfaces, unnecessary helper functions, and other engineering practices like production environment code in a company.
- So I need research code to be as concise, minimal, and easy to read as possible.

## Testing Requirements

- Every source file must include a standalone `main()` function that serves as a unit test
- The `main()` function should:
  - Demonstrate key functionality of the file
  - Include visualization when applicable to verify correctness
  - Provide clear visual or textual output showing that features work correctly
  - Be executable directly (e.g., `uv run filename.py`)
