const colours = {
    red: { border: 'border-red-500', background: 'bg-red-500' },
    yellow: { border: 'border-yellow-500', background: 'bg-yellow-500' },
    green: { border: 'border-green-500', background: 'bg-green-500' },
};

export default function Trello({ title, colour, children }) {
    return (
        <div className={'w-1/3 overflow-y-auto h-96 border-8 ' + colours[colour].border}>
            <h1 className={'justify-center ' + colours[colour].background}>{title}</h1>
            {children}
        </div>
    );
}
