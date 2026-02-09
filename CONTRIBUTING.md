# Contributing

We welcome contributions! This project is simple and designed to be easy to extend.

## Getting Started

### Development Setup

```bash
git clone https://github.com/gabrielmoreira/tiny-asl-machine.git
cd tiny-asl-machine
pnpm install
```

### Running Tests

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch
```

### Building

```bash
pnpm build
```

### Code Quality

```bash
pnpm lint
pnpm format
```

## How to Contribute

### Report a Bug

Create an issue with:
- What you tried
- What happened
- What you expected
- Minimal code example

### Suggest a Feature

Create an issue describing:
- What problem it solves
- How you'd use it
- Example code if applicable

### Submit Code

1. Fork the repo
2. Create a feature branch: `git checkout -b fix/issue-name`
3. Make your changes
4. Add tests for new functionality
5. Run `pnpm test` and `pnpm lint`
6. Commit with clear messages
7. Push and create a Pull Request

## Project Structure

```
src/
├── index.ts                # Public API
├── states/index.ts         # State execution logic
├── choices/operators.ts    # Choice state operators (30+)
└── utils/                  # Helper functions
    ├── parseTemplate.ts
    ├── selectPath.ts
    ├── updatePath.ts
    └── ...
types/                      # TypeScript definitions
tests/                      # Test suite
```

## Code Style

- Use TypeScript with strict mode
- Use `const`/`let`, not `var`
- Use type annotations for functions
- Export public API from `src/index.ts`
- Add JSDoc comments for public APIs

## Testing

- Use Vitest
- Test happy paths and error cases
- Name tests clearly
- Example:

```typescript
it('should execute Pass state and return input', async () => {
  const definition = {
    StartAt: 'MyPass',
    States: { MyPass: { Type: 'Pass', End: true } },
  };
  const result = await run({ definition }, { test: 'data' });
  expect(result).toEqual({ test: 'data' });
});
```

## Areas That Need Help

1. **Bug fixes** - Found an issue? Fix it!
2. **Feature implementation** - Implement missing features
3. **Tests** - Add edge case tests
4. **Documentation** - Improve examples

## Notes

- This library is for **testing only**, not production
- Keep it simple and lightweight
- Don't add external dependencies unless absolutely necessary
- Focus on ASL correctness

## Questions?

Open an issue or start a discussion!
