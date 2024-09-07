import { expose } from "comlink";

export interface Worker {
    run(data: Uint8Array): Promise<string>;
}

const krakScript = `from pyodide.http import pyfetch
response = await pyfetch("./krak.zip")
await response.unpack_archive()

from Krakatau.java.visitor import DefaultVisitor
from Krakatau.java.javaclass import generateAST
from Krakatau.ssa import ssaFromVerified
from Krakatau.verifier.inference_verifier import verifyBytecode
from Krakatau.java.stringescape import escapeString
from Krakatau.environment import Environment
from Krakatau.classfile import ClassFile
from Krakatau.classfileformat.reader import Reader

def makeGraph(m):
    v = verifyBytecode(m.code)
    s = ssaFromVerified(m.code, v, opts=False)

    if s.procs:
        s.inlineSubprocs()

    s.condenseBlocks()
    s.mergeSingleSuccessorBlocks()
    s.removeUnusedVariables()

    s.copyPropagation()
    s.abstractInterpert()
    s.disconnectConstantVariables()

    s.simplifyThrows()
    s.simplifyCatchIgnored()
    s.mergeSingleSuccessorBlocks()
    s.mergeSingleSuccessorBlocks()
    s.removeUnusedVariables()

    return s

def decompile(data):
    e = Environment()

    c = ClassFile(Reader(data=bytes(data.to_py())))
    c.env = e

    e.classes[c.name] = c

    c.loadElements()

    printer = DefaultVisitor()
    source = printer.visit(generateAST(c, makeGraph, skip_errors=True))

    if '/' in c.name:
        return f'package {escapeString(c.name.replace('/','.').rpartition('.')[0])};\\n\\n{source}'

    return source

decompile`;

let decompileFunc: ((data: Uint8Array) => string) | null = null;

expose({
    async run(data: Uint8Array): Promise<string> {
        if (!decompileFunc) {
            decompileFunc = await import("https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.mjs")
                .then(({ loadPyodide }) => loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/" }))
                .then(({ runPythonAsync }) => runPythonAsync(krakScript));
        }

        return decompileFunc(data);
    },
} satisfies Worker);
