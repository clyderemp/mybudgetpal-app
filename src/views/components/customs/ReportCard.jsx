export default function ReportCard({ title, description, date }) {
    return (
        <div className="h-24 border border-black">
            <h3>{title}</h3>
            <p>Date: {date}</p>
        </div>
    );
}
