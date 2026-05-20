import type { TacoLanguage } from "./types";

const FENCE = "```";

export const SYSTEM =
  "You are a very experienced and knowledgeable programmer supporting TACO, a trust assessment method for coding assistance tasks. Follow the task-specific instructions exactly.";

const pythonTestCompletionPrompt = (question: string, answer: string, feedback: string) => `You are a very experienced and knowledgeable programmer. You will get a question and answer from StackOverflow. Your task is to convert this question and answer into complete,concise and testable code in a Python environment by appropriately supplementing or rewriting them.

This step corresponds to TACO's Test Case Generation and Code Completion stage. First extract or synthesize a minimal test case that reproduces the phenomenon described by the questioner and can verify whether the answer resolves it. If previous failed attempt feedback is provided, use it as TACO re-completion feedback and regenerate the minimal test case and completed code.

### Definition of converted code
By rewriting appropriately, enable it to run directly in a Python environment, using Assert to recreate the phenomena described by the questioner (for question) or verify whether the solution resolves the issue (for answer).

For real-world coding assistance tasks, snippets may be incomplete or depend on custom project code. When a dependency is not available, infer its functionality from context and add a concise comment describing the assumption instead of inventing unrelated behavior.

### Code Template
After rewriting, you need to separately produce the question code and the answer code, following the format below inside the JSON fields questionCode and answerCode:

${FENCE}python
# Question code
import ... as ...  # Import any necessary modules

def question_code(test_case):  
    # Implement to reproduce the phenomenon described by the questioner
    ...

if __name__ == "__main__":
    test_case = ...  # Test case
    question_output = ...  # Set the corresponding output according to the content of the question
    assert question_code(test_case) == question_output, "The question was not successfully reproduced"
${FENCE}

${FENCE}python
# Answer code
import ... as ...  

def answer_code(test_case):  
    # Implementing the proposed solution in the Answer
    ...

if __name__ == "__main__":
    test_case = ...  # Test case
    expected_output = ...  # Set the expected output according to the content of the answer
    assert answer_code(test_case) == expected_output, "The answer does not produce the expected results"
${FENCE}
Note: The question code and answer code must be separated and formatted as described above.

### Examples
Here are an example of input and output:

#### Example-1:

**Input:**

Question:
Why do I get a TypeError when trying to add an integer to a string? How can I fix it?

${FENCE}python
num = 10
text = " apples"
result = num + text  # Raise a TypeError.
${FENCE}

Answer:
Converting the integer to a string before concatenation can resolve this issue.

${FENCE}python
num = 10
text = " apples"
result = str(num) + text  # After converting to a string, concatenate.
${FENCE}

**Output:**

${FENCE}python
# Question code
def question_code(test_case):
    num, text = test_case
    try:
        tmp = num + text  # Attempt to add directly reproducing TypeError
    except TypeError:
        return "TypeError"

if __name__ == "__main__":
    test_case = (10, " apples")
    question_output = "TypeError"
    assert question_code(test_case) == question_output, "The question was not successfully reproduced."  # Verify the question
${FENCE}

${FENCE}python
# Answer code
def answer_code(test_case):
    num, text = test_case
    return str(num) + text  # Convert to string before adding

if __name__ == "__main__":
    test_case = (10, " apples")
    expected_output = "10 apples"
    assert answer_code(test_case) == expected_output, "The answer does not produce the expected result"  # Verify the answer resolves the problem
${FENCE}

### Output Format
Return only a valid JSON object. The code strings must contain the same style of code shown in the original output format above.

${FENCE}json
{
  "testCaseSummary": "<brief explanation of the minimal test case>",
  "reproductionGoal": "<what the question code reproduces>",
  "resolutionGoal": "<what the answer code verifies>",
  "questionCode": "<Question code as one Python string>",
  "answerCode": "<Answer code as one Python string>"
}
${FENCE}

Now, Please convert the following question and answer:

Question:
${question}

Answer:
${answer}

Previous failed attempt feedback:
${feedback}`;

const javaTestCompletionPrompt = (question: string, answer: string, feedback: string) => `You are a very experienced and knowledgeable programmer. You will get a question and answer from StackOverflow. Your task is to convert this question and answer into complete,concise and testable code in a Java environment by appropriately supplementing or rewriting them.

This step corresponds to TACO's Test Case Generation and Code Completion stage. First extract or synthesize a minimal test case that reproduces the phenomenon described by the questioner and can verify whether the answer resolves it. If previous failed attempt feedback is provided, use it as TACO re-completion feedback and regenerate the minimal test case and completed code.

### Definition of converted code
By rewriting appropriately, enable it to run directly in a Java environment, using assertions to recreate the phenomena described by the questioner (for question) or verify whether the solution resolves the issue (for answer).

For real-world coding assistance tasks, snippets may be incomplete or depend on custom project code. When a dependency is not available, infer its functionality from context and add a concise comment describing the assumption instead of inventing unrelated behavior.

### Code Template
After rewriting, you need to separately produce the question code and the answer code, following the format below inside the JSON fields questionCode and answerCode:

${FENCE}java
// Question code
import ...; // Import any necessary classes

public class TacoQuestion {
    static Object questionCode(Object testCase) {
        // Implement to reproduce the phenomenon described by the questioner
        ...
    }

    public static void main(String[] args) {
        Object testCase = ...; // Test case
        Object questionOutput = ...; // Set the corresponding output according to the content of the question
        assert questionCode(testCase).equals(questionOutput) : "The question was not successfully reproduced";
    }
}
${FENCE}

${FENCE}java
// Answer code
import ...;

public class TacoAnswer {
    static Object answerCode(Object testCase) {
        // Implementing the proposed solution in the Answer
        ...
    }

    public static void main(String[] args) {
        Object testCase = ...; // Test case
        Object expectedOutput = ...; // Set the expected output according to the content of the answer
        assert answerCode(testCase).equals(expectedOutput) : "The answer does not produce the expected results";
    }
}
${FENCE}
Note: The question code and answer code must be separated and formatted as described above.

### Examples
Here are an example of input and output:

#### Example-1:

**Input:**

Question:
Why do I get an incompatible types error when assigning an integer/string concatenation to an int? How can I fix it?

${FENCE}java
int num = 10;
String text = " apples";
int result = num + text; // Compilation error: String cannot be converted to int.
${FENCE}

Answer:
Use a String result and concatenate after converting the integer to a string.

${FENCE}java
int num = 10;
String text = " apples";
String result = Integer.toString(num) + text;
${FENCE}

**Output:**

${FENCE}java
// Question code
public class TacoQuestion {
    static Object questionCode(Object testCase) {
        Object[] values = (Object[]) testCase;
        int num = (Integer) values[0];
        String text = (String) values[1];
        // Simulate the Java compilation error from assigning a String expression to an int.
        return "CompilationError";
    }

    public static void main(String[] args) {
        Object testCase = new Object[]{10, " apples"};
        Object questionOutput = "CompilationError";
        assert questionCode(testCase).equals(questionOutput) : "The question was not successfully reproduced.";
    }
}
${FENCE}

${FENCE}java
// Answer code
public class TacoAnswer {
    static Object answerCode(Object testCase) {
        Object[] values = (Object[]) testCase;
        int num = (Integer) values[0];
        String text = (String) values[1];
        return Integer.toString(num) + text;
    }

    public static void main(String[] args) {
        Object testCase = new Object[]{10, " apples"};
        Object expectedOutput = "10 apples";
        assert answerCode(testCase).equals(expectedOutput) : "The answer does not produce the expected result.";
    }
}
${FENCE}

### Output Format
Return only a valid JSON object. The code strings must contain the same style of code shown in the original output format above.

${FENCE}json
{
  "testCaseSummary": "<brief explanation of the minimal test case>",
  "reproductionGoal": "<what the question code reproduces>",
  "resolutionGoal": "<what the answer code verifies>",
  "questionCode": "<Question code as one Java string>",
  "answerCode": "<Answer code as one Java string>"
}
${FENCE}

Now, Please convert the following question and answer:

Question:
${question}

Answer:
${answer}

Previous failed attempt feedback:
${feedback}`;

const pythonInterpreterPrompt = (code: string) => `You are a Python virtual executor responsible for simulating the execution of key lines of the given code, analyzing program operation according to the actual execution order of the code. 

For what you consider to be the key line, your task is to output:

1. **Analysis**: Describe the functionality of this line, along with its intended purpose during execution.
2. **Execution result**: Simulate running the code and provide the result of this line of code.
3. **Current state update**: Clearly display the variables and program state after this line is executed.

### Input Description
The input is a **code block**, where the main function contains assertions.

### Output Description
A **code block** with comments added after key lines of the input code. Each comment should include: 1. Analysis, 2. Execution result, 3. Current state update, and should be concise.

Note: The key lines are defined by you, you need to analyze the code first and decide which lines are critical, but the last line must be a key line. In TACO, also determine whether the final assertion passes, fails, or is unknown under the simulated execution.

### Examples
Here is an example of input and output:

**Input:**

${FENCE}python
# Question code
def question_code(test_case):
    num, text = test_case
    try:
        tmp = num + text  
    except TypeError:
        return "TypeError"

if __name__ == "__main__":
    test_case = (10, " apples")
    question_output = "TypeError"
    assert question_code(test_case) == question_output, "The question was not successfully reproduced."  # Verify the question
${FENCE}

**Output:**

${FENCE}python
def question_code(test_case): 
    num, text = test_case 
    try: 
        tmp = num + text  # 1. Analysis: Attempt to add num (integer) and text (string). 2. Execution result: Raises TypeError, as integers cannot be added to strings. 3. Current state update: tmp is undefined, exception is raised.
    except TypeError:
        return "TypeError"  # 1. Analysis: Return string "TypeError". 2. Execution result: Function returns "TypeError". 3. Current state update: Function execution ends, return value is "TypeError".
if __name__ == "__main__":  
    test_case = (10, " apples")  
    question_output = "TypeError"  
    assert question_code(test_case) == question_output, "The question was not successfully reproduced." # 1. Analysis: Call question_code(test_case) and assert the return value equals question_output. 2. Execution result: Calling question_code((10, " apples")) returns "TypeError", assertion succeeds, no exception. 3. Current state update: Program execution completes, all assertions pass.
${FENCE}

### Output Format
Return only a valid JSON object:

${FENCE}json
{
  "annotatedCode": "<the output code block with comments after key lines>",
  "assertStatus": "pass|fail|unknown",
  "failureReason": "<empty when pass; otherwise explain the failed or unknown assertion>",
  "traceSummary": "<brief execution summary>"
}
${FENCE}

Now, please execute the following code block:

${code}`;

const javaInterpreterPrompt = (code: string) => `You are a Java virtual executor responsible for simulating the execution of key lines of the given code, analyzing program operation according to the actual execution order of the code. 

For what you consider to be the key line, your task is to output:

1. **Analysis**: Describe the functionality of this line, along with its intended purpose during execution.
2. **Execution result**: Simulate running the code and provide the result of this line of code.
3. **Current state update**: Clearly display the variables and program state after this line is executed.

### Input Description
The input is a **Java code block**, where the main method contains assertions.

### Output Description
A **code block** with comments added after key lines of the input code. Each comment should include: 1. Analysis, 2. Execution result, 3. Current state update, and should be concise.

Note: The key lines are defined by you, you need to analyze the code first and decide which lines are critical, but the last assertion line must be a key line. In TACO, also determine whether the final assertion passes, fails, or is unknown under the simulated execution.

### Examples
Here is an example of input and output:

**Input:**

${FENCE}java
// Question code
public class TacoQuestion {
    static Object questionCode(Object testCase) {
        Object[] values = (Object[]) testCase;
        int num = (Integer) values[0];
        String text = (String) values[1];
        return "CompilationError";
    }

    public static void main(String[] args) {
        Object testCase = new Object[]{10, " apples"};
        Object questionOutput = "CompilationError";
        assert questionCode(testCase).equals(questionOutput) : "The question was not successfully reproduced.";
    }
}
${FENCE}

**Output:**

${FENCE}java
public class TacoQuestion {
    static Object questionCode(Object testCase) {
        Object[] values = (Object[]) testCase; // 1. Analysis: Cast the test case to an Object array. 2. Execution result: values references [10, " apples"]. 3. Current state update: values is initialized.
        int num = (Integer) values[0]; // 1. Analysis: Read the integer input. 2. Execution result: num is 10. 3. Current state update: num = 10.
        String text = (String) values[1]; // 1. Analysis: Read the string input. 2. Execution result: text is " apples". 3. Current state update: text = " apples".
        return "CompilationError"; // 1. Analysis: Simulate the Java compilation error described by the question. 2. Execution result: Function returns "CompilationError". 3. Current state update: Function execution ends.
    }

    public static void main(String[] args) {
        Object testCase = new Object[]{10, " apples"};
        Object questionOutput = "CompilationError";
        assert questionCode(testCase).equals(questionOutput) : "The question was not successfully reproduced."; // 1. Analysis: Call questionCode and compare with expected output. 2. Execution result: The assertion succeeds. 3. Current state update: Program execution completes, all assertions pass.
    }
}
${FENCE}

### Output Format
Return only a valid JSON object:

${FENCE}json
{
  "annotatedCode": "<the output code block with comments after key lines>",
  "assertStatus": "pass|fail|unknown",
  "failureReason": "<empty when pass; otherwise explain the failed or unknown assertion>",
  "traceSummary": "<brief execution summary>"
}
${FENCE}

Now, please execute the following code block:

${code}`;

export const codeQualityPrompt = (args: {
  question: string;
  answer: string;
  questionCode: string;
  questionTrace: string;
  answerCode: string;
  answerTrace: string;
  language?: TacoLanguage;
}) => `You are a highly skilled and experienced code evaluator. You will be given a question from Stack Overflow, an LLM-generated answer, and the execution results of executable code from both the question and answer. Your task is to evaluate the quality of the answer in terms of its code correctness and execution outcomes. More specifically, you will evaluate the acceptability of the answer using the definition and rubric below.

### Code Acceptability Definition
Code acceptability measures how effectively the code in an answer satisfies the user's requirements and addresses their issue. It evaluates whether the code provides a viable solution, focusing on its accuracy, functionality, and completeness. An acceptable code solution runs correctly without errors and produces the expected results. Minor inefficiencies or non-critical inaccuracies are permissible if they do not affect the usability of the code.

### Code Acceptability Evaluation Rubric
Choose exactly one integer score {0, 1, 2, 3}.
**Score 0 (Completely Unacceptable):**
- The code fails to execute or produces incorrect results, with substantial errors and no viable solution to the user's problem.
- The user would immediately disregard this code and continue searching for a better solution.

**Score 1 (Useful but Unacceptable):**
- Contains some correct code elements but also significant inaccuracies or lacks important logic, prompting additional debugging or research.
- Provides some value but requires further modification or debugging for a complete and satisfactory solution.

**Score 2 (Acceptable):**
- The code is mostly accurate, with correct logic and execution, free of critical errors that would prevent problem resolution.
- Provides enough functionality for most users to proceed without additional help, even if some user-specific details need to be filled in.

**Score 3 (Optimal):**
- The code is 100% accurate and produces the correct results, with detailed logic that improves the code's quality and usability.
- The user is likely to feel well-informed and be able to apply the solution effectively, with the code being considered a reliable and optimal solution.

### Assessment Guidelines
1. **Question Analysis** - Analyze the question to pinpoint the core requirements for an acceptable code solution.
2. **Generated Code Analysis** - Carefully Analyze the generated code and its execution results for the given question by taking into account the question's requirements.
3. **Acceptability Evaluation** - Reason on the acceptability of the generated code, analyzing how well it executes and meets the user's needs.
4. **Acceptability Score** - Output the integer score (0-3).

### Output Format
Ensure your evaluation results are formatted into a valid JSON object as outlined below:
${FENCE}json
{
    "questionAnalysis": "<string>",
    "generatedCodeAnalysis": "<string>",
    "acceptabilityEvaluation": "<string>",
    "acceptabilityScore": <0|1|2|3>
}
${FENCE}

### Inputs
**User Question**
${args.question}

**LLM-Generated Answer**
${args.answer}

**Question Code Execution Result**  
${args.questionTrace}

**Answer Code Execution Result**  
${args.answerTrace}`;

export const alignmentPrompt = (question: string, answer: string) => `You are a seasoned Stack Overflow answer-alignment reviewer.  
Given a user question and an LLM-generated answer, decide how well the answer aligns with the user's explicit and implicit intent, **not merely whether the answer is "correct."**  
Follow the intent-alignment definition, four-level scoring rubric, and output format below.

### Intent-Alignment Definition
Intent-alignment measures the degree to which the answer respects the user's requirements and solves the problem the user actually cares about.  
An aligned answer must:  
- Address the same problem the user asked about.  
- Satisfy the stated constraints (e.g., language version, library, performance, style).  
- Avoid introducing contradictions or omissions that force the user to look elsewhere.

### Intent-Alignment Scoring Rubric 
Choose exactly one integer score {0, 1, 2, 3}.
**0 (Completely Misaligned)**  
- Tackles a different problem or ignores the core constraints.  
- Useless in practice; the user must discard it entirely.

**1 (Partially Aligned but Problematic)**  
- Touches on the right topic but breaks or omits key constraints.  
- Requires major fixes or extra research before it can help.

**2 (Mostly Aligned)**  
- Meets most important constraints and essentially solves the problem.  
- Only minor, non-critical deviations remain; quick tweaks are acceptable.

**3 (Perfectly Aligned)**  
- Fully satisfies every explicit and implicit requirement.  
- Ready to use as-is; no edits or extra checks needed.

### Assessment Procedure
1. **Question Analysis** - Identify the user’s true goal and mandatory constraints.  
2. **Answer Analysis** - Compare the answer against those requirements, noting strengths and weaknesses.  
3. **Alignment Evaluation** - Conclude, in one concise sentence, whether the answer is aligned, referencing the rubric.  
4. **Score Assignment** - Output the integer score (0-3).

### Output Format
Ensure your evaluation results are formatted into a valid JSON object as outlined below:
${FENCE}json
{
    "questionAnalysis": "<string>",
    "answerAnalysis": "<string>",
    "alignmentEvaluation": "<string>",
    "alignmentScore": <0|1|2|3>
}
${FENCE}

### Inputs
**User Question**
${question}

**LLM-Generated Answer**
${answer}`;

export const testCompletionPrompt = (
  question: string,
  answer: string,
  feedback: string,
  language: TacoLanguage = "python",
) => (language === "java" ? javaTestCompletionPrompt(question, answer, feedback) : pythonTestCompletionPrompt(question, answer, feedback));

export const interpreterPrompt = (code: string, language: TacoLanguage = "python") =>
  language === "java" ? javaInterpreterPrompt(code) : pythonInterpreterPrompt(code);
