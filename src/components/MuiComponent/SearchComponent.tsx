import { TextField } from '@mui/material';

export default function SearchComponent(props) {
    let { SearchText, setSearchText, LabelSearch } = props;

    return (
        <TextField
            fullWidth
            label={LabelSearch}
            variant="outlined"
            placeholder={LabelSearch}
            type="text"
            value={SearchText}
            onChange={(event) =>
                setSearchText(event.target.value)
            }
        />
    );
}