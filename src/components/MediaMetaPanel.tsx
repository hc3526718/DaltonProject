import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { DS } from '../designSystem';

type Props = {
  category: string;
  title: string;
  description: string;
  tags: string[];
};

/** Media player metadata: category pill → title → description → tag chips. */
export function MediaMetaPanel({ category, title, description, tags }: Props) {
  return (
    <View style={styles.wrap}>
      {category ? (
        <View style={styles.categoryCell}>
          <Text style={styles.categoryText}>{category}</Text>
        </View>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {tags.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tagsRow}
        >
          {tags.map((tag) => (
            <View key={tag} style={styles.tagCell}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: DS.space.lg,
    gap: DS.space.sm,
  },
  categoryCell: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: DS.radius.md,
    backgroundColor: DS.color.goldTint10,
    borderWidth: 1,
    borderColor: DS.color.cardBorder,
  },
  categoryText: {
    fontFamily: DS.font.bodyBold,
    fontSize: 11,
    color: DS.color.gold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: DS.font.heading,
    fontSize: 26,
    lineHeight: 32,
    color: DS.color.text,
    letterSpacing: 0.3,
  },
  description: {
    fontFamily: DS.font.body,
    fontSize: 15,
    lineHeight: 22,
    color: DS.color.textMuted,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: DS.space.sm,
    paddingTop: DS.space.xs,
    flexWrap: 'nowrap',
  },
  tagCell: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: DS.radius.md,
    backgroundColor: DS.color.surface,
    borderWidth: 1,
    borderColor: DS.color.borderHairline,
  },
  tagText: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 12,
    color: DS.color.text,
    letterSpacing: 0.3,
  },
});
