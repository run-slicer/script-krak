import { expose } from "comlink";

export interface Worker {
    decompile(data: Uint8Array): Promise<string>;
    disassemble(data: Uint8Array): Promise<string>;
}

const krakScript = `from pyodide.http import pyfetch
response = await pyfetch("https://cdn.jsdelivr.net/gh/run-slicer/script-krak@${__SCRIPT_VERSION__}/dist/krak.zip")
await response.unpack_archive()

from io import StringIO

from Krakatau.java.visitor import DefaultVisitor
from Krakatau.java.javaclass import generateAST
from Krakatau.ssa import ssaFromVerified
from Krakatau.verifier.inference_verifier import verifyBytecode
from Krakatau.java.stringescape import escapeString
from Krakatau.environment import Environment
from Krakatau.classfile import ClassFile
from Krakatau.classfileformat.reader import Reader
from Krakatau.classfileformat.classdata import ClassData
from Krakatau.assembler.disassembly import Disassembler

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

def disassemble(data):
    c = ClassData(Reader(data=bytes(data.to_py())))

    output = StringIO()
    Disassembler(c, output.write, roundtrip=False).disassemble()

    return output.getvalue()`;

type KrakFunc = (data: Uint8Array) => string;

let decompileFunc: KrakFunc | null = null;
let disassembleFunc: KrakFunc | null = null;

const loadFuncs = async () => {
    await import("https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.mjs")
        .then(({ loadPyodide }) => loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/" }))
        .then(async ({ runPythonAsync, globals }) => {
            await runPythonAsync(krakScript);

            decompileFunc = globals.get("decompile");
            disassembleFunc = globals.get("disassemble");
        });
};

expose({
    async decompile(data: Uint8Array): Promise<string> {
        if (!decompileFunc) {
            await loadFuncs();
        }

        return decompileFunc(data);
    },
    async disassemble(data: Uint8Array): Promise<string> {
        if (!disassembleFunc) {
            await loadFuncs();
        }

        return disassembleFunc(data);
    },
} satisfies Worker);
