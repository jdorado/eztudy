---
{"id":"instructions","title":"A recipe a machine can follow","purpose":"Identify the input, steps and stopping point of a simple procedure.","tags":["foundations","session-1"],"type":"markdown","provenance":{"text":"Original Eztudy example, distributed under the repository MIT license.","sources":[]}}
---
An algorithm is a precise procedure for solving a problem. Its **input** describes what it starts with; its output describes the answer it produces.

# Find a book

Walk along a shelf from left to right. Read each title and compare it with the one you want. Stop when it matches, or when there are no books left.

1. Read the next title.
2. Return its position if it matches.
3. Otherwise continue until the shelf ends.

> A stopping rule is part of the procedure, not an afterthought.

```text
for each book:
    if its title matches:
        return its position

return not_found
```
