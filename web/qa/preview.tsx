// Isolated development entry, not imported by the authenticated app or production build.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Icon } from '../src/Icon'
import { MarkdownContent } from '../src/MarkdownContent'
import { LearningSpace } from '../src/LearningSpace'
import type { Program } from '../src/content'
import '../src/style.css'

const programs: Program[] = [{
  id:'preview-computation', title:'Thinking with computers', purpose:'Understand how a precise process turns a question into an answer.',
  items:[{
    id:'preview-instructions', title:'A recipe a machine can follow', purpose:'See why an algorithm needs precise steps and a stopping point.', tags:['foundations','session-1'],
    content:{type:'markdown', markdown:`A computer follows instructions. The interesting part is deciding **which instructions** express the problem you want to solve.

# From a question to a process

Imagine a shelf of books. You want to find a particular title. One method is to start at the left, read each spine, and stop when you find a match. The method works even if the books have no special order.

That method is an *algorithm*: a sequence of steps with a clear meaning. Its input is the shelf and the title. Its output is either the book's location or a statement that the book is absent.

## Make the ending explicit

1. Look at the next book.
2. If its title matches, return its position.
3. If no books remain, return “not found”.
4. Otherwise, repeat.

> A useful instruction says both what to do and when to stop.

## Represent the idea

\`\`\`text
for each book on the shelf:
    if book.title equals wanted_title:
        return book.position

return not_found
\`\`\`

The blank line in the example separates the search from its final result. It does not add an extra instruction. The machine needs a representation of each title and a rule for comparing titles.

## What changes with a larger shelf?

With twice as many books, this method may need twice as many comparisons. That observation connects a precise procedure to its cost. We can compare procedures without needing to know the brand of computer that runs them.

The next readout explores a different strategy when the books are already sorted.`},
    provenance:{text:'Original Eztudy layout sample, written for UI QA. Redistributable under the repository MIT license; not published learning content.',sources:[]}
  },{
    id:'preview-search',title:'Use order to narrow a search',purpose:'Understand how a sorted collection lets you discard half the possibilities.',tags:['foundations','search'],content:{type:'markdown',markdown:`Order is useful because it gives you information about what you have not yet inspected.

# Split the possibilities

Open a dictionary near its middle. If your word comes earlier, the later half cannot contain it. Repeat with the half that remains.

- Each comparison removes many possible locations.
- The method depends on a consistent ordering rule.
- An empty remaining range means the word is absent.

The structure of the input changes which procedures are available.`},provenance:{text:'Original Eztudy layout sample. MIT licensed.',sources:[]}
  }]
},{id:'preview-observation',title:'The art of noticing',purpose:'Describe an observation before explaining it.',items:[]}]
function Preview() {
  const [selected, setSelected] = useState(programs[0].id)
  const coach = (
    <section className="chat-window" aria-label="Coach preview">
      <div className="chat-body">
        <div className="chat-empty message-stack ai-stack">
          <span className="message-avatar" aria-hidden="true">AI</span>
          <div className="message ai"><p>Start a conversation with Coach...</p></div>
        </div>
        <div className="message-stack user-stack">
          <div className="message user">What makes an instruction precise?</div>
        </div>
        <div className="message-stack ai-stack">
          <span className="message-avatar" aria-hidden="true">AI</span>
          <div className="message ai"><MarkdownContent markdown={'It gives the reader enough information to choose one next action. “Find a book” leaves choices open; “read the next spine from left to right” makes the next step clear.'} /></div>
        </div>
      </div>
      <div className="chat-composer">
        <div className="chat-input">
          <button type="button" className="composer-attach" disabled aria-label="Attach a file"><Icon name="attach" /></button>
          <textarea disabled placeholder="Message" rows={1} />
          <button className="chat-send" type="button" disabled aria-label="Send"><Icon name="send" size={24} /></button>
        </div>
      </div>
    </section>
  )
  return <LearningSpace preview content={{programs, selected_program_id:selected}} onSelectProgram={setSelected} identity={{name:'Layout preview'}} coach={coach} />
}
createRoot(document.getElementById('app')!).render(<Preview />)
